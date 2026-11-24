export {};
process.env['SPEC_TEST_PART'] = '7';
await import('./enforcement-suite');
delete process.env['SPEC_TEST_PART'];
