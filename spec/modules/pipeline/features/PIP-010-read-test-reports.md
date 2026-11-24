---
id: PIP-010
title: Read the test report of any stack
module: pipeline
status: active
---
## Intent
spec works on any stack, so it reads the report file a test command writes in the formats most runners can produce, telling them apart by content: vitest or jest JSON, the Dart and Flutter JSON event stream, and JUnit XML, which pytest, Go, Gradle, Maven, .NET and most CI runners write. Each test becomes one name and one status.

## Behaviour
### S1: vitest or jest JSON
Given a report file holding {"testResults": [{"assertionResults": [{"title": "PRV-002/S1 Fallback enabled", "status": "passed"}, {"title": "PRV-002/S3 x", "status": "failed"}, {"title": "y", "status": "pending"}]}]}
When the tests run through pipeline.RunTests
Then pipeline.TestRun.tests is [{name "PRV-002/S1 Fallback enabled", status "passed"}, {name "PRV-002/S3 x", status "failed"}, {name "y", status "skipped"}] (R1)

### S2: The Dart and Flutter event stream
Given a report of one JSON event per line, as `dart test --reporter json` or `flutter test --machine` print it:
```text
{"protocolVersion":"0.1.1","runnerVersion":"1.31.1","type":"start","time":0}
{"test":{"id":1,"name":"loading test/prv_test.dart"},"type":"testStart"}
{"testID":1,"result":"success","skipped":false,"hidden":true,"type":"testDone"}
{"test":{"id":3,"name":"PRV-002 S1 Fallback enabled"},"type":"testStart"}
{"testID":3,"result":"success","skipped":false,"hidden":false,"type":"testDone"}
{"test":{"id":4,"name":"PRV-002/S3 Fallback provider also rate-limits"},"type":"testStart"}
{"testID":4,"error":"Expected: <4>","type":"error"}
{"testID":4,"result":"failure","skipped":false,"hidden":false,"type":"testDone"}
{"success":false,"type":"done"}
```
When the tests run through pipeline.RunTests
Then pipeline.TestRun.tests is [{name "PRV-002 S1 Fallback enabled", status "passed"}, {name "PRV-002/S3 Fallback provider also rate-limits", status "failed"}] (R2)

### S3: A Dart test file that does not compile
Given an event stream whose only test is the hidden "loading test/x_test.dart", done with result "error"
When the tests run through pipeline.RunTests
Then pipeline.TestRun.tests is [{name "loading test/x_test.dart", status "failed"}] (R2)

### S4: Package output before the events
Given the lines "Resolving dependencies...", "Downloading packages...", "  clock 1.1.2 (1.1.3 available)" and "Got dependencies!", then the event stream of S2
When the tests run through pipeline.RunTests
Then pipeline.TestRun.tests is the same as in S2 (R2)

### S5: A skipped Dart test
Given an event stream where a test is done with result "success" and skipped true
When the tests run through pipeline.RunTests
Then that pipeline.TestCase.status is "skipped"

### S6: JUnit XML
Given a report file holding:
```text
<?xml version="1.0"?><testsuites><testsuite name="s">
  <testcase classname="t" name="test_PRV_002_S1_fallback_enabled" time="0.1"/>
  <testcase classname="t" name="PRV-002/S3 Fallback &amp; rate limits"><failure message="x">boom</failure></testcase>
  <testcase classname="t" name="TestSET_001_S2Disable"><skipped/></testcase>
</testsuite></testsuites>
```
When the tests run through pipeline.RunTests
Then pipeline.TestRun.tests is [{name "test_PRV_002_S1_fallback_enabled", status "passed"}, {name "PRV-002/S3 Fallback & rate limits", status "failed"}, {name "TestSET_001_S2Disable", status "skipped"}] (R3)

### S7: Text that is no report
Given a report file holding "not a report"
When the tests run through pipeline.RunTests
Then it fails with pipeline.NoTestResults and pipeline.TestRun.error "the test report is neither JSON nor JUnit XML"

### S8: JSON in no known shape
Given a report file holding {"ok":true}
When the tests run through pipeline.RunTests
Then it fails with pipeline.NoTestResults and pipeline.TestRun.error "the JSON test report is not in the vitest/jest or Dart format"

### S9: vitest or jest tell an assertion from an error
Given a vitest JSON report whose failed test "PRV-001/S4 Streams from gemini" has failureDetails [{"name": "TypeError"}] and failureMessages ["TypeError: gemini.stream is not a function\n    at ..."], and whose failed test "PRV-001/S5 Streams a reply" has failureDetails [{"name": "AssertionError"}]
When the tests run through pipeline.RunTests
Then pipeline.TestCase.failureKind of the first is "error" and pipeline.TestCase.firstErrorLine is "TypeError: gemini.stream is not a function" (R4)
And pipeline.TestCase.failureKind of the second is "assertion" (R4)

### S10: JUnit separates error from failure
Given a JUnit report whose testcase "PRV-001/S4 Streams from gemini" holds an "error" element with message "boom", and whose testcase "PRV-001/S5 Streams a reply" holds a "failure" element
When the tests run through pipeline.RunTests
Then pipeline.TestCase.failureKind of the first is "error" and pipeline.TestCase.firstErrorLine is "boom" (R4)
And pipeline.TestCase.failureKind of the second is "assertion" (R4)

### S11: A report that does not tell them apart
Given a vitest JSON report whose failed test has no failureDetails and no failureMessages
When the tests run through pipeline.RunTests
Then pipeline.TestCase.failureKind and pipeline.TestCase.firstErrorLine of that test are left out (R4)

### S12: XML that is not a JUnit report
Given a report file holding "<html><body><h1>502 Bad Gateway</h1></body></html>"
When the tests run through pipeline.RunTests
Then it fails with pipeline.NoTestResults and pipeline.TestRun.error "the XML test report is not a complete JUnit report" (R3)
And pipeline.TestRun.tests is [] (R3)

### S13: A JUnit report cut off before its end
Given a report file holding a JUnit report whose "testsuites" element is not closed, after one complete "testcase"
When the tests run through pipeline.RunTests
Then it fails with pipeline.NoTestResults and pipeline.TestRun.error "the XML test report is not a complete JUnit report" (R3)

### S14: A JUnit report with no test cases
Given a report file holding a complete JUnit report whose "testsuite" holds no "testcase"
When the tests run through pipeline.RunTests
Then pipeline.TestRun.tests is [] and pipeline.TestRun.error is null (R3)

### S15: A quoted ']' in the DOCTYPE
Given a report file holding:
```text
<?xml version="1.0"?>
<!DOCTYPE testsuites [<!ENTITY example "a]b">]>
<testsuites><testsuite name="s">
  <testcase classname="t" name="PRV-002/S1 Fallback enabled"/>
</testsuite></testsuites>
```
When the tests run through pipeline.RunTests
Then pipeline.TestRun.tests is [{name "PRV-002/S1 Fallback enabled", status "passed"}] and pipeline.TestRun.error is null (R3)

## Rules
- R1: In vitest or jest JSON, each assertion result is one test named by its title; "passed" and "failed" keep their status and every other status is "skipped".
- R2: The event stream starts at the first line that is a JSON object with "protocolVersion" or a type of "start", "testStart" or "suite", and needs at least one more line after it; lines before it and lines that are not JSON are ignored. A test is named at its "testStart" and gets its status at its "testDone": "failure" or "error" fail it, skipped true skips it, anything else passes it. A hidden test, the runner's own, is listed only when it fails.
- R3: Text starting with "<" is XML and counts as a JUnit report only when its root element is "testsuites" or "testsuite" and that element is closed; any other XML (a different root, an HTML page, a file cut off) has no results, like unknown JSON, and a complete JUnit report with no "testcase" is a valid run of zero tests, as an empty vitest or jest report is. A DOCTYPE before the root, with or without an internal subset in square brackets, does not make a report incomplete; a ']' or '[' inside a quoted literal of the subset (an entity value, say) does not end or open it. In a JUnit report each "testcase" with a name is one test, failed when it holds a "failure" or "error" element, skipped when it holds "skipped", else passed; the five XML entities in names are decoded.
- R4: A failed test gets pipeline.TestCase.failureKind from its report: in vitest or jest JSON, "assertion" when the failure's type name (its failureDetails name, else the name that starts its failure message) holds "Assertion" or "Expected", "error" for any other type; in the Dart stream, "assertion" for result "failure" and "error" for result "error"; in JUnit, "assertion" for a "failure" element and "error" for an "error" element. pipeline.TestCase.firstErrorLine is the first non-blank line of the failure message (JUnit: its "message" attribute, else the element's text). With no such information both are left out.

## Out of scope
- TAP, and any format not listed
- Test durations, and failure messages beyond the first line (R4)
