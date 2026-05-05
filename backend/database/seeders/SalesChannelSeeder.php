<?php

namespace Database\Seeders;

use App\Models\SalesChannel;
use Illuminate\Database\Seeder;

class SalesChannelSeeder extends Seeder
{
    public function run(): void
    {
        $channels = [
            ['code' => 'TOKOPEDIA', 'name' => 'Tokopedia', 'type' => 'marketplace'],
            ['code' => 'SHOPEE',    'name' => 'Shopee',    'type' => 'marketplace'],
            ['code' => 'TIKTOK',    'name' => 'TikTok Shop','type' => 'marketplace'],
            ['code' => 'IG',        'name' => 'Instagram', 'type' => 'social_media'],
            ['code' => 'FB',        'name' => 'Facebook',  'type' => 'social_media'],
            ['code' => 'WA',        'name' => 'WhatsApp',  'type' => 'social_media'],
            ['code' => 'OFFLINE',   'name' => 'Offline / Datang Langsung', 'type' => 'offline'],
        ];

        foreach ($channels as $c) {
            SalesChannel::updateOrCreate(['code' => $c['code']], $c);
        }
    }
}
