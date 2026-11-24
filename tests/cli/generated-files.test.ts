export {};
process.env['SPEC_TEST_PART'] = '0';
await import('./generated-files-suite');
delete process.env['SPEC_TEST_PART'];
