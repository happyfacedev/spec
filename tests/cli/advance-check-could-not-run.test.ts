export {};
process.env['SPEC_TEST_PART'] = '0';
await import('./advance-check-could-not-run-suite');
delete process.env['SPEC_TEST_PART'];
