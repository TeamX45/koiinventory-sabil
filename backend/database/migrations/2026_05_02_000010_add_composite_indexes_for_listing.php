<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Composite indexes untuk pattern query "ORDER BY *_date DESC, id DESC" yang dipakai
 * di list endpoint paginated. Tanpa ini, paginate(50) di tabel 100k+ rows scan
 * full filesort + temp table.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->index(['purchase_date', 'id'], 'idx_purchases_listing');
            $table->index(['status', 'purchase_date'], 'idx_purchases_status_date');
        });

        Schema::table('sales', function (Blueprint $table) {
            $table->index(['sale_date', 'id'], 'idx_sales_listing');
            $table->index(['status', 'sale_date'], 'idx_sales_status_date');
        });

        Schema::table('harvests', function (Blueprint $table) {
            $table->index(['harvest_date', 'id'], 'idx_harvests_listing');
            $table->index(['status', 'harvest_date'], 'idx_harvests_status_date');
        });

        Schema::table('sortings', function (Blueprint $table) {
            $table->index(['sorting_date', 'id'], 'idx_sortings_listing');
            $table->index(['status', 'sorting_date'], 'idx_sortings_status_date');
        });

        Schema::table('stock_opnames', function (Blueprint $table) {
            $table->index(['opname_date', 'id'], 'idx_stock_opnames_listing');
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->index(['movement_date', 'id'], 'idx_stock_movements_listing');
        });

        Schema::table('mortalities', function (Blueprint $table) {
            $table->index(['mortality_date', 'id'], 'idx_mortalities_listing');
        });
    }

    public function down(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->dropIndex('idx_purchases_listing');
            $table->dropIndex('idx_purchases_status_date');
        });
        Schema::table('sales', function (Blueprint $table) {
            $table->dropIndex('idx_sales_listing');
            $table->dropIndex('idx_sales_status_date');
        });
        Schema::table('harvests', function (Blueprint $table) {
            $table->dropIndex('idx_harvests_listing');
            $table->dropIndex('idx_harvests_status_date');
        });
        Schema::table('sortings', function (Blueprint $table) {
            $table->dropIndex('idx_sortings_listing');
            $table->dropIndex('idx_sortings_status_date');
        });
        Schema::table('stock_opnames', function (Blueprint $table) {
            $table->dropIndex('idx_stock_opnames_listing');
        });
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropIndex('idx_stock_movements_listing');
        });
        Schema::table('mortalities', function (Blueprint $table) {
            $table->dropIndex('idx_mortalities_listing');
        });
    }
};
