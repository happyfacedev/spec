export {};
process.env['SPEC_TEST_PART'] = '2';
await import('./generated-files-suite');
delete process.env['SPEC_TEST_PART'];
