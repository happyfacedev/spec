export {};
process.env['SPEC_TEST_PART'] = '1';
await import('./next-suite');
delete process.env['SPEC_TEST_PART'];
