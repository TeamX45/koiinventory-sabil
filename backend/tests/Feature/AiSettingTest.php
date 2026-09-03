<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AiSettingTest extends TestCase
{
    use RefreshDatabase;

    private const KUNCI = 'AIzaSyTESTTESTTESTTESTTESTTEST123456';

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        config(['services.gemini.key' => null, 'services.gemini.model' => 'gemini-bawaan']);
    }

    private function actAs(string $role): User
    {
        $user = User::create([
            'name' => ucfirst($role), 'email' => "{$role}@test.local",
            'password' => 'x', 'role' => $role, 'is_active' => true,
        ]);
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_only_owner_may_touch_the_api_key(): void
    {
        foreach (['staff', 'admin'] as $role) {
            $this->actAs($role);
            $this->getJson('/api/v1/settings/ai')->assertStatus(403);
            $this->putJson('/api/v1/settings/ai', ['api_key' => self::KUNCI])->assertStatus(403);
            $this->deleteJson('/api/v1/settings/ai')->assertStatus(403);
        }

        $this->actAs('owner');
        $this->getJson('/api/v1/settings/ai')->assertOk();
    }

    public function test_saved_key_is_encrypted_at_rest_and_never_returned_in_full(): void
    {
        $this->actAs('owner');

        $this->putJson('/api/v1/settings/ai', ['api_key' => self::KUNCI])
            ->assertOk()
            ->assertJsonPath('data.terpasang', true)
            ->assertJsonPath('data.sumber', 'pengaturan');

        // Jawaban API tidak boleh memuat kuncinya.
        $body = $this->getJson('/api/v1/settings/ai')->assertOk();
        $this->assertStringNotContainsString(self::KUNCI, $body->getContent());
        $this->assertSame('AIza******3456', $body->json('data.preview'));

        // Begitu juga isi tabelnya: kolom value tersimpan terenkripsi.
        $raw = DB::table('app_settings')->where('key', AppSetting::GEMINI_API_KEY)->value('value');
        $this->assertNotSame(self::KUNCI, $raw);
        $this->assertStringNotContainsString(self::KUNCI, (string) $raw);
        $this->assertSame(self::KUNCI, AppSetting::get(AppSetting::GEMINI_API_KEY));
    }

    public function test_key_from_settings_is_the_one_actually_used_for_analysis(): void
    {
        $this->actAs('owner');
        Http::fake([
            '*generativelanguage.googleapis.com*' => Http::response([
                'candidates' => [[
                    'content' => ['parts' => [['text' => json_encode([
                        'ringkasan' => 'ok', 'temuan' => [], 'rekomendasi' => [],
                    ])]]],
                ]],
            ]),
        ]);

        $this->putJson('/api/v1/settings/ai', [
            'api_key' => self::KUNCI,
            'model'   => 'gemini-pilihan',
        ])->assertOk()->assertJsonPath('data.model', 'gemini-pilihan');

        $this->postJson('/api/v1/ai/analysis')->assertOk();

        Http::assertSent(fn (ClientRequest $r) => $r->hasHeader('x-goog-api-key', self::KUNCI)
            && str_contains($r->url(), 'models/gemini-pilihan:generateContent'));
    }

    public function test_deleting_the_key_falls_back_to_the_env_value(): void
    {
        $this->actAs('owner');
        $this->putJson('/api/v1/settings/ai', ['api_key' => self::KUNCI])->assertOk();

        config(['services.gemini.key' => 'kunci-dari-env']);

        $this->deleteJson('/api/v1/settings/ai')
            ->assertOk()
            ->assertJsonPath('data.terpasang', true)
            ->assertJsonPath('data.sumber', 'env');

        $this->assertNull(AppSetting::get(AppSetting::GEMINI_API_KEY));
    }

    public function test_model_list_comes_from_google_and_drops_unusable_models(): void
    {
        $this->actAs('owner');
        AppSetting::put(AppSetting::GEMINI_API_KEY, self::KUNCI);

        Http::fake([
            '*generativelanguage.googleapis.com/v1beta/models*' => Http::response([
                'models' => [
                    [
                        'name' => 'models/gemini-flash', 'displayName' => 'Gemini Flash',
                        'supportedGenerationMethods' => ['generateContent'],
                    ],
                    [
                        'name' => 'models/text-embedding', 'displayName' => 'Embedding',
                        'supportedGenerationMethods' => ['embedContent'],
                    ],
                ],
            ]),
        ]);

        $this->getJson('/api/v1/settings/ai/models')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 'gemini-flash')
            ->assertJsonPath('data.0.nama', 'Gemini Flash');
    }

    public function test_connection_test_reports_a_rejected_key_in_plain_language(): void
    {
        $this->actAs('owner');
        AppSetting::put(AppSetting::GEMINI_API_KEY, self::KUNCI);

        Http::fake([
            '*generativelanguage.googleapis.com*' => Http::response(
                ['error' => ['message' => 'API key not valid. Please pass a valid API key.']],
                400
            ),
        ]);

        $this->postJson('/api/v1/settings/ai/test')
            ->assertStatus(503)
            ->assertJsonFragment(['message' => 'Kunci API Gemini ditolak. Pastikan kuncinya disalin utuh dari Google AI Studio.']);
    }

    public function test_connection_test_confirms_a_working_key(): void
    {
        $this->actAs('owner');
        AppSetting::put(AppSetting::GEMINI_API_KEY, self::KUNCI);
        AppSetting::put(AppSetting::GEMINI_MODEL, 'gemini-pilihan');

        Http::fake([
            '*generativelanguage.googleapis.com*' => Http::response([
                'candidates' => [[
                    'content' => ['parts' => [['text' => '{"ok":"ya"}']]],
                ]],
            ]),
        ]);

        $this->postJson('/api/v1/settings/ai/test')
            ->assertOk()
            ->assertJsonFragment(['message' => 'Berhasil terhubung ke Gemini memakai model gemini-pilihan.']);
    }

    public function test_a_key_that_is_obviously_too_short_is_rejected(): void
    {
        $this->actAs('owner');

        $this->putJson('/api/v1/settings/ai', ['api_key' => 'pendek'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('api_key');
    }
}
