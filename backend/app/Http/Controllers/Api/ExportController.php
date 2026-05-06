<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\StockOpname;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Export laporan ke CSV.
 * CSV dipakai (bukan XLSX) supaya tidak butuh package tambahan — semua aplikasi
 * spreadsheet (Excel, Google Sheets, LibreOffice) bisa buka CSV langsung.
 *
 * Header BOM UTF-8 ditambahkan supaya Excel mengenali encoding & karakter
 * Indonesia tidak rusak.
 */
class ExportController extends Controller
{
    /**
     * Export stok aktif per kolam — semua baris ikan yang masih ada.
     * GET /v1/exports/inventory.csv
     */
    public function inventoryCsv()
    {
        $filename = 'inventaris-' . now()->format('Y-m-d-His') . '.csv';

        return $this->stream($filename, function () {
            $out = fopen('php://output', 'w');

            // BOM UTF-8 supaya Excel kenali encoding
            fputs($out, "\xEF\xBB\xBF");

            fputcsv($out, [
                'Kode Batch', 'Lokasi', 'Kolam', 'Kategori Kolam',
                'Jenis Ikan', 'Grade', 'Ukuran cm', 'Ukuran cm Max',
                'Stok (ekor)', 'Stok Awal', 'Harga/ekor', 'Total Nilai',
                'Sumber', 'Tanggal Masuk', 'Status',
            ]);

            Batch::with(['pond.location', 'pond.category', 'fishType', 'grade'])
                ->where('status', 'active')
                ->orderBy('pond_id')
                ->orderBy('id')
                ->chunk(500, function ($batches) use ($out) {
                    foreach ($batches as $b) {
                        $price = $b->price_per_fish ? (float) $b->price_per_fish : 0;
                        $totalValue = $price * (int) $b->current_count;
                        fputcsv($out, [
                            $b->code,
                            $b->pond?->location?->name ?? '-',
                            $b->pond?->name ?? '-',
                            $b->pond?->category?->name ?? '-',
                            $b->fishType?->name ?? '-',
                            $b->grade?->name ?? 'Belum disortir',
                            $b->size_cm ?? '',
                            $b->size_max_cm ?? '',
                            $b->current_count,
                            $b->initial_count,
                            $price,
                            $totalValue,
                            $b->source_type,
                            optional($b->entry_date)->toDateString(),
                            $b->status,
                        ]);
                    }
                });

            fclose($out);
        });
    }

    /**
     * Export stok opname (semua atau filter tanggal).
     * GET /v1/exports/stock-opnames.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
     */
    public function stockOpnamesCsv(Request $request)
    {
        $from = $request->input('from');
        $to   = $request->input('to');

        $filename = 'opname-' . now()->format('Y-m-d-His') . '.csv';

        return $this->stream($filename, function () use ($from, $to) {
            $out = fopen('php://output', 'w');
            fputs($out, "\xEF\xBB\xBF");

            fputcsv($out, [
                'Kode', 'Tanggal', 'Lokasi', 'Kolam',
                'Jenis', 'Grade', 'Ukuran cm',
                'Stok Sistem', 'Hitung Fisik', 'Selisih',
                'Status', 'Catatan',
            ]);

            $query = StockOpname::with(['batch.pond.location', 'batch.fishType', 'batch.grade'])
                ->orderByDesc('opname_date')
                ->orderByDesc('id');

            if ($from) $query->where('opname_date', '>=', $from);
            if ($to)   $query->where('opname_date', '<=', $to);

            $query->chunk(500, function ($opnames) use ($out) {
                foreach ($opnames as $s) {
                    fputcsv($out, [
                        $s->code,
                        optional($s->opname_date)->toDateString(),
                        $s->batch?->pond?->location?->name ?? '-',
                        $s->batch?->pond?->name ?? '-',
                        $s->batch?->fishType?->name ?? '-',
                        $s->batch?->grade?->name ?? 'Belum disortir',
                        $s->batch?->size_cm ?? '',
                        $s->system_count,
                        $s->actual_count,
                        $s->difference,
                        $s->status,
                        $s->notes ?? '',
                    ]);
                }
            });

            fclose($out);
        });
    }

    private function stream(string $filename, callable $writer): StreamedResponse
    {
        return response()->stream($writer, 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control'       => 'no-store, no-cache, must-revalidate',
            'Pragma'              => 'no-cache',
        ]);
    }
}
