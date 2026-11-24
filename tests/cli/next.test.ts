export {};
process.env['SPEC_TEST_PART'] = '0';
await import('./next-suite');
delete process.env['SPEC_TEST_PART'];
