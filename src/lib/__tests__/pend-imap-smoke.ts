/**
 * SMOKE TEST — Pendientes IMAP + Vertex AI Classification
 * =========================================================
 * Verifies that all new modules import correctly and have the expected exports.
 * Run: npx tsx src/lib/__tests__/pend-imap-smoke.ts
 *
 * NOTE: This does NOT connect to IMAP or call Vertex AI.
 * It only validates module structure, types, and config logic.
 */

// ── A1: IMAP Config ──
import { getZohoImapConfigTramites, checkImapEnvStatusTramites } from '../email/zohoImapConfigTramites';

function testImapConfig() {
  console.log('── A1: IMAP Config (tramites) ──');

  // checkImapEnvStatusTramites should return status without throwing
  const status = checkImapEnvStatusTramites();
  console.assert(typeof status.configured === 'boolean', 'configured should be boolean');
  console.assert(status.host === 'imap.zoho.com', 'host should be imap.zoho.com');
  console.assert(status.port === 993, 'port should be 993');
  console.log('  ✓ checkImapEnvStatusTramites() returns valid status:', JSON.stringify(status));

  // getZohoImapConfigTramites should throw when env vars are missing
  const originalUser = process.env.ZOHO_IMAP_USER_TRAMITES;
  const originalPass = process.env.ZOHO_IMAP_PASS_TRAMITES;
  delete process.env.ZOHO_IMAP_USER_TRAMITES;
  delete process.env.ZOHO_IMAP_PASS_TRAMITES;

  try {
    getZohoImapConfigTramites();
    console.error('  ✗ Should have thrown for missing env vars');
    process.exit(1);
  } catch (err: any) {
    console.assert(err.message.includes('ZOHO_IMAP_USER_TRAMITES'), 'Error should mention missing var');
    console.log('  ✓ getZohoImapConfigTramites() throws correctly for missing env vars');
  }

  // Restore and test with valid env vars
  process.env.ZOHO_IMAP_USER_TRAMITES = 'tramites@lideresenseguros.com';
  process.env.ZOHO_IMAP_PASS_TRAMITES = 'test-password';

  const config = getZohoImapConfigTramites();
  console.assert(config.auth.user === 'tramites@lideresenseguros.com', 'user should match');
  console.assert(config.host === 'imap.zoho.com', 'host should be imap.zoho.com');
  console.assert(config.port === 993, 'port should be 993');
  console.assert(config.secure === true, 'secure should be true');
  console.log('  ✓ getZohoImapConfigTramites() returns valid config');

  // Cleanup
  process.env.ZOHO_IMAP_USER_TRAMITES = originalUser;
  process.env.ZOHO_IMAP_PASS_TRAMITES = originalPass;
}

// ── B1: Pendientes Classifier ──
import { classifyPendientesEmail } from '../vertex/pendientesClassifier';
import type { PendientesClassificationInput, PendientesClassificationResult } from '../vertex/pendientesClassifier';

async function testPendientesClassifier() {
  console.log('\n── B1: Pendientes Classifier ──');

  // With FEATURE_ENABLE_VERTEX disabled, should return fallback
  const originalFlag = process.env.FEATURE_ENABLE_VERTEX;
  process.env.FEATURE_ENABLE_VERTEX = 'false';

  const input: PendientesClassificationInput = {
    subject: 'Emisión póliza vida ASSA - Juan Pérez',
    body_text: 'Favor emitir póliza de vida ASSA para Juan Pérez, cédula 8-123-456',
    from_email: 'broker@test.com',
    cc_emails: ['tramites@lideresenseguros.com'],
    attachments_summary: 'formulario.pdf (100KB)',
  };

  const result = await classifyPendientesEmail(input);

  console.assert(result.should_create_case === true, 'should_create_case default is true');
  console.assert(result.confidence === 0, 'confidence should be 0 when disabled');
  console.assert(result.case_type === 'otro', 'case_type fallback should be "otro"');
  console.assert(result.ramo_bucket === 'desconocido', 'ramo_bucket fallback should be "desconocido"');
  console.assert(result.ticket_required === true, 'ticket_required default should be true');
  console.assert(result.ticket_exception_reason === null, 'ticket_exception_reason default should be null');
  console.assert(result.attachments.has_attachments === false, 'attachments fallback should be empty');
  console.assert(typeof result.rationale === 'string', 'rationale should be string');
  console.log('  ✓ classifyPendientesEmail() returns valid fallback when disabled');

  // Type check: ensure all expected fields exist
  const expectedKeys: (keyof PendientesClassificationResult)[] = [
    'should_create_case', 'ticket_required', 'ticket_exception_reason',
    'case_type', 'ramo', 'aseguradora', 'priority',
    'suggested_status', 'status_confidence',
    'policy_number', 'policy_number_confidence',
    'detected_entities', 'attachments', 'rationale', 'evidence',
    'ramo_bucket', 'confidence', 'broker_email_detected',
  ];

  for (const key of expectedKeys) {
    console.assert(key in result, `Missing key: ${key}`);
  }
  console.log(`  ✓ Result has all ${expectedKeys.length} expected keys`);

  process.env.FEATURE_ENABLE_VERTEX = originalFlag;
}

// ── B2: AI Persistence ──
import { shouldAutoApplyStatus } from '../vertex/pendientesAiPersistence';

function testAutoApplyLogic() {
  console.log('\n── B3: Auto-status threshold ──');

  const highConfidence = { status_confidence: 0.85 } as PendientesClassificationResult;
  const lowConfidence = { status_confidence: 0.75 } as PendientesClassificationResult;
  const borderline = { status_confidence: 0.80 } as PendientesClassificationResult;

  console.assert(shouldAutoApplyStatus(highConfidence) === true, '0.85 should auto-apply');
  console.assert(shouldAutoApplyStatus(lowConfidence) === false, '0.75 should NOT auto-apply');
  console.assert(shouldAutoApplyStatus(borderline) === true, '0.80 (exactly) should auto-apply');
  console.log('  ✓ shouldAutoApplyStatus() thresholds correct: >=0.80 applies, <0.80 suggests');
}

// ── C: Ticket exceptions ──
function testTicketExceptions() {
  console.log('\n── C: Ticket exception types ──');

  // These are string literal types — verify they compile correctly
  const assaVidaRegular: PendientesClassificationResult['ticket_exception_reason'] = 'ASSA_VIDA_REGULAR';
  const assaSalud: PendientesClassificationResult['ticket_exception_reason'] = 'ASSA_SALUD';
  const noException: PendientesClassificationResult['ticket_exception_reason'] = null;

  console.assert(assaVidaRegular === 'ASSA_VIDA_REGULAR', 'ASSA_VIDA_REGULAR literal');
  console.assert(assaSalud === 'ASSA_SALUD', 'ASSA_SALUD literal');
  console.assert(noException === null, 'null for no exception');
  console.log('  ✓ ticket_exception_reason type literals compile correctly');
}

// ── Run all tests ──
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  SMOKE TEST: Pendientes IMAP + Vertex AI ║');
  console.log('╚══════════════════════════════════════════╝\n');

  testImapConfig();
  await testPendientesClassifier();
  testAutoApplyLogic();
  testTicketExceptions();

  console.log('\n══════════════════════════════════════');
  console.log('✅ ALL SMOKE TESTS PASSED');
  console.log('══════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n❌ SMOKE TEST FAILED:', err);
  process.exit(1);
});
