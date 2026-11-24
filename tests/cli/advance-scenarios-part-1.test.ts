export {};
process.env['SPEC_TEST_PART'] = '1';
await import('./advance-scenarios-suite');
delete process.env['SPEC_TEST_PART'];
