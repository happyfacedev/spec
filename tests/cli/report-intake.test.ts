export {};
process.env['SPEC_TEST_PART'] = '0';
await import('./report-intake-suite');
delete process.env['SPEC_TEST_PART'];
