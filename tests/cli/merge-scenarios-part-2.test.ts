export {};
process.env['SPEC_TEST_PART'] = '2';
await import('./merge-scenarios-suite');
delete process.env['SPEC_TEST_PART'];
