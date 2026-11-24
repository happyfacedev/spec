export {};
process.env['SPEC_TEST_PART'] = '1';
await import('./report-intake-suite');
delete process.env['SPEC_TEST_PART'];
