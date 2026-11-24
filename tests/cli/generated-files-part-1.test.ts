export {};
process.env['SPEC_TEST_PART'] = '1';
await import('./generated-files-suite');
delete process.env['SPEC_TEST_PART'];
