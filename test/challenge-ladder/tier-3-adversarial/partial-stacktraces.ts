/**
 * Tier 3 — Partial Stack Traces (15 fixtures)
 *
 * Missing top frames, repeated bottom frames, mixed language traces.
 * Check: Fox preserves all frames, doesn't collapse unique ones.
 */
import type { ChallengeFixture } from "../types"

export const TIER3_PARTIAL_STACKTRACE_FIXTURES: readonly ChallengeFixture[] = [
  {
    id: "stacktrace-t3-01",
    tier: 3, category: "partial-stacktraces",
    description: "Missing top frames — only bottom of call stack visible",
    seed: 22001,
    input: {
      content: `    ... 14 more frames
    at EventLoop.run (node:internal/event_loop:89:12)
    at Worker.execute (/app/src/worker.ts:34:8)
    at TaskRunner.process (/app/src/runner.ts:67:14)
    at QueueConsumer.handle (/app/src/queue.ts:112:22)
    at /app/src/index.ts:8:3`,
      tool: "bash", command: "node dist/index.js",
    },
    expected: {
      type: "robustness",
      mustContain: ["14 more frames", "Worker.execute", "TaskRunner.process", "QueueConsumer.handle"],
      workflow: "swe",
    },
  },
  {
    id: "stacktrace-t3-02",
    tier: 3, category: "partial-stacktraces",
    description: "Repeated bottom frames (recursive stack overflow)",
    seed: 22002,
    input: {
      content: `RangeError: Maximum call stack size exceeded
    at JsonSerializer.serialize (/app/src/serializer.ts:45:12)
    at JsonSerializer.serializeValue (/app/src/serializer.ts:52:18)
    at JsonSerializer.serialize (/app/src/serializer.ts:45:12)
    at JsonSerializer.serializeValue (/app/src/serializer.ts:52:18)
    at JsonSerializer.serialize (/app/src/serializer.ts:45:12)
    at JsonSerializer.serializeValue (/app/src/serializer.ts:52:18)
    at JsonSerializer.serialize (/app/src/serializer.ts:45:12)
    at JsonSerializer.serializeValue (/app/src/serializer.ts:52:18)
    at JsonSerializer.serialize (/app/src/serializer.ts:45:12)
    at JsonSerializer.serializeValue (/app/src/serializer.ts:52:18)`,
      tool: "bash", command: "bun run build",
    },
    expected: {
      type: "robustness",
      mustContain: ["Maximum call stack size exceeded", "JsonSerializer.serialize", "JsonSerializer.serializeValue", "serializer.ts:45:12"],
      workflow: "swe",
    },
  },
  {
    id: "stacktrace-t3-03",
    tier: 3, category: "partial-stacktraces",
    description: "Mixed Python and JavaScript stack traces in same output",
    seed: 22003,
    input: {
      content: `=== Python Backend Error ===
Traceback (most recent call last):
  File "/srv/api/views.py", line 42, in handle_request
    result = process_data(payload)
  File "/srv/api/processor.py", line 18, in process_data
    return json.loads(raw_string)
json.JSONDecodeError: Expecting ',' delimiter: line 3 column 15

=== Node.js Proxy Error ===
Error: upstream returned 500
    at ProxyHandler.forward (/gateway/src/proxy.ts:89:14)
    at Router.handle (/gateway/src/router.ts:45:20)
    at Server.<anonymous> (/gateway/src/index.ts:12:8)`,
      tool: "bash", command: "docker compose logs --tail 20",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "Python Backend Error",
        "process_data",
        "JSONDecodeError",
        "Node.js Proxy Error",
        "ProxyHandler.forward",
        "upstream returned 500",
      ],
      workflow: "swe",
    },
  },
  {
    id: "stacktrace-t3-04",
    tier: 3, category: "partial-stacktraces",
    description: "Stack trace with no line numbers (minified production code)",
    seed: 22004,
    input: {
      content: `TypeError: Cannot read properties of null (reading 'map')
    at e.render (app.min.js:1:34567)
    at t.update (app.min.js:1:45678)
    at n.flush (app.min.js:1:56789)
    at r.tick (app.min.js:1:67890)
    at s (vendor.min.js:1:12345)
    at Object.next (vendor.min.js:1:23456)`,
      tool: "bash", command: "node dist/server.js",
    },
    expected: {
      type: "robustness",
      mustContain: ["Cannot read properties of null", "app.min.js", "vendor.min.js", "e.render", "t.update"],
      workflow: "swe",
    },
  },
  {
    id: "stacktrace-t3-05",
    tier: 3, category: "partial-stacktraces",
    description: "Extremely long single-line stack trace (Go-style panic)",
    seed: 22005,
    input: {
      content: `goroutine 1 [running]:
runtime.gopanic({0x1234560, 0xc000100120})
	/usr/local/go/src/runtime/panic.go:1234 +0x1a2
main.(*Server).handleConnection(0xc0001a0000, {0x7f8b4c0, 0xc0002a0000})
	/app/cmd/server/main.go:89 +0x3a5
main.(*Server).listenAndServe(0xc0001a0000)
	/app/cmd/server/main.go:45 +0x1b2
main.main()
	/app/cmd/server/main.go:23 +0x8f

goroutine 18 [IO wait]:
internal/poll.runtime_pollWait(0x7f8b00152b48, 0x72)
	/usr/local/go/src/runtime/netpoll.go:343 +0x85
net.(*pollDesc).waitRead(...)
	/usr/local/go/src/net/fd_poll_runtime.go:89 +0x32`,
      tool: "bash", command: "./server",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "goroutine 1 [running]",
        "gopanic",
        "handleConnection",
        "goroutine 18 [IO wait]",
        "pollWait",
      ],
      workflow: "swe",
    },
  },
  {
    id: "stacktrace-t3-06",
    tier: 3, category: "partial-stacktraces",
    description: "Java stack trace with suppressed exceptions and caused-by chain",
    seed: 22006,
    input: {
      content: `java.lang.RuntimeException: Failed to initialize application
	at com.app.Application.start(Application.java:42)
	at com.app.Main.main(Main.java:15)
	Suppressed: java.io.IOException: Failed to close resource
		at com.app.db.ConnectionPool.close(ConnectionPool.java:89)
		at com.app.Application.cleanup(Application.java:67)
	Caused by: java.sql.SQLException: Connection refused
		at com.mysql.cj.jdbc.ConnectionImpl.createNewIO(ConnectionImpl.java:826)
		at com.mysql.cj.jdbc.ConnectionImpl.<init>(ConnectionImpl.java:456)
		at com.app.db.ConnectionPool.init(ConnectionPool.java:34)
		at com.app.Application.start(Application.java:38)
		... 1 more`,
      tool: "bash", command: "java -jar app.jar",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "RuntimeException",
        "Suppressed",
        "IOException",
        "Caused by",
        "SQLException",
        "Connection refused",
      ],
      workflow: "swe",
    },
  },
  {
    id: "stacktrace-t3-07",
    tier: 3, category: "partial-stacktraces",
    description: "Rust backtrace with #[number] frame format",
    seed: 22007,
    input: {
      content: `thread 'main' panicked at 'index out of bounds: the len is 3 but the index is 5', src/parser.rs:42:15
stack backtrace:
   0: std::panicking::begin_panic_handler
   1: core::panicking::panic_fmt
   2: core::panicking::panic_bounds_check
   3: app::parser::Parser::parse_token
             at ./src/parser.rs:42:15
   4: app::parser::Parser::parse
             at ./src/parser.rs:28:9
   5: app::main
             at ./src/main.rs:12:5
   6: std::rt::lang_start::{{closure}}
   7: std::rt::lang_start_internal`,
      tool: "bash", command: "cargo run",
    },
    expected: {
      type: "robustness",
      mustContain: ["index out of bounds", "len is 3 but the index is 5", "Parser::parse_token", "parser.rs:42:15"],
      workflow: "swe",
    },
  },
  {
    id: "stacktrace-t3-08",
    tier: 3, category: "partial-stacktraces",
    description: "Async stack trace with gaps (Promise boundaries)",
    seed: 22008,
    input: {
      content: `Error: Request timeout after 30000ms
    at Timeout._onTimeout (/app/src/client.ts:78:15)
    at listOnTimeout (node:internal/timers:573:17)
    at process.processTimers (node:internal/timers:514:7)
--- async gap ---
    at HttpClient.request (/app/src/client.ts:72:12)
    at ApiService.fetchUser (/app/src/api.ts:34:20)
--- async gap ---
    at UserController.getProfile (/app/src/controllers/user.ts:18:22)
    at Router.dispatch (/app/node_modules/express/lib/router.js:112:10)`,
      tool: "bash", command: "node --async-stack-traces dist/index.js",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "Request timeout after 30000ms",
        "async gap",
        "HttpClient.request",
        "ApiService.fetchUser",
        "UserController.getProfile",
      ],
      workflow: "swe",
    },
  },
  {
    id: "stacktrace-t3-09",
    tier: 3, category: "partial-stacktraces",
    description: "Truncated at fixed depth (AWS Lambda max trace depth)",
    seed: 22009,
    input: {
      content: `Error: Lambda execution failed
    at Runtime.handler (/var/task/index.js:15:11)
    at Runtime.handleOnceNonStreaming (/var/runtime/index.mjs:1085:29)
    at Runtime.handleOnce (/var/runtime/index.mjs:1126:20)
    ... 8 lines matching cause 'DynamoDB.DocumentClient'
    at DynamoDBClient.send (/var/task/node_modules/@aws-sdk/client-dynamodb/dist/cjs/DynamoDBClient.js:187:29)
    at /var/task/node_modules/@aws-sdk/lib-dynamodb/dist/cjs/DynamoDBDocumentClient.js:81:35`,
      tool: "bash", command: "aws lambda invoke",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "Lambda execution failed",
        "8 lines matching cause",
        "DynamoDBClient.send",
        "DynamoDBDocumentClient",
      ],
      workflow: "swe",
    },
  },
  {
    id: "stacktrace-t3-10",
    tier: 3, category: "partial-stacktraces",
    description: "Multiple errors in sequence (test suite output with stack traces)",
    seed: 22010,
    input: {
      content: `FAIL test/integration.test.ts
  ● Auth Suite › login with invalid credentials

    Error: Expected 401, received 500
        at Object.<anonymous> (test/integration.test.ts:45:22)

  ● Auth Suite › token refresh after expiry

    Error: JWT expired
        at verifyToken (src/auth/jwt.ts:23:11)
        at Object.<anonymous> (test/integration.test.ts:67:18)

  ● Database Suite › handles connection timeout

    Error: Timeout of 5000ms exceeded
        at Timeout._onTimeout (node:internal/timers:573:17)
        at listOnTimeout (node:internal/timers:514:7)

Tests: 3 failed, 12 passed, 15 total`,
      tool: "bash", command: "bun test test/integration.test.ts",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "login with invalid credentials",
        "Expected 401, received 500",
        "token refresh after expiry",
        "JWT expired",
        "handles connection timeout",
        "3 failed, 12 passed",
      ],
      workflow: "swe",
    },
  },
  {
    id: "stacktrace-t3-11",
    tier: 3, category: "partial-stacktraces",
    description: "Stack trace with source map references",
    seed: 22011,
    input: {
      content: `TypeError: this.setState is not a function
    at UserProfile.componentDidMount (webpack:///src/components/UserProfile.tsx?:34:12)
    at commitLifeCycles (webpack:///node_modules/react-dom/cjs/react-dom.development.js?:22345:22)
    at commitLayoutEffects (webpack:///node_modules/react-dom/cjs/react-dom.development.js?:25367:7)
    at HTMLUnknownElement.callCallback (webpack:///node_modules/react-dom/cjs/react-dom.development.js?:3945:14)
    at Object.invokeGuardedCallbackDev (webpack:///node_modules/react-dom/cjs/react-dom.development.js?:3994:16)`,
      tool: "bash", command: "npm start",
    },
    expected: {
      type: "robustness",
      mustContain: ["setState is not a function", "UserProfile.componentDidMount", "webpack:///src", "react-dom.development.js"],
      workflow: "swe",
    },
  },
  {
    id: "stacktrace-t3-12",
    tier: 3, category: "partial-stacktraces",
    description: "Segfault with register dump (C/native module crash)",
    seed: 22012,
    input: {
      content: `
#
# Fatal error in , line 0
# Check failed: false.
#
#
#FailureMessage Object: 0x7ffd4c2b3a90
 1: 0xd7e193  [node]
 2: 0x1e8a554 V8_Fatal(char const*, ...) [node]
 3: 0xf4c24c v8::internal::Scanner::ScanSingleToken() [node]
 4: 0xf50d89 v8::internal::Scanner::Scan() [node]

SIGSEGV received at address 0x000000000000
Registers:
  rax: 0x0000000000000000  rbx: 0x00007f8b4c000120
  rcx: 0x0000000000000001  rdx: 0x00000000deadbeef
  rip: 0x0000000000f4c24c  rsp: 0x00007ffd4c2b3890`,
      tool: "bash", command: "node --max-old-space-size=4096 dist/index.js",
    },
    expected: {
      type: "robustness",
      mustContain: ["Fatal error", "SIGSEGV", "V8_Fatal", "0x00000000deadbeef"],
      workflow: "swe",
    },
  },
  {
    id: "stacktrace-t3-13",
    tier: 3, category: "partial-stacktraces",
    description: "Python asyncio traceback with task references",
    seed: 22013,
    input: {
      content: `Task exception was never retrieved
future: <Task finished name='Task-12' coro=<fetch_data() done, defined at /app/src/fetcher.py:23> exception=ConnectionError('Connection reset by peer')>
Traceback (most recent call last):
  File "/app/src/fetcher.py", line 28, in fetch_data
    async with session.get(url) as response:
  File "/usr/lib/python3.12/aiohttp/client.py", line 1141, in __aenter__
    self._resp = await self._coro
  File "/usr/lib/python3.12/aiohttp/client.py", line 536, in _request
    conn = await self._connector.connect(req, traces=traces)
ConnectionError: Connection reset by peer`,
      tool: "bash", command: "python -m asyncio src/main.py",
    },
    expected: {
      type: "robustness",
      mustContain: ["Task exception was never retrieved", "Task-12", "fetch_data", "ConnectionError", "Connection reset by peer"],
      workflow: "swe",
    },
  },
  {
    id: "stacktrace-t3-14",
    tier: 3, category: "partial-stacktraces",
    description: "Elixir/Erlang stack trace with module:function/arity format",
    seed: 22014,
    input: {
      content: `** (EXIT) an exception was raised:
    ** (KeyError) key :email not found in: %{name: "Alice", role: :admin}
        (app 0.1.0) lib/app/user.ex:15: App.User.get_email/1
        (app 0.1.0) lib/app/mailer.ex:8: App.Mailer.send_welcome/1
        (app 0.1.0) lib/app/registration.ex:23: App.Registration.complete/1
        (elixir 1.16.0) lib/task/supervised.ex:101: Task.Supervised.invoke_mfa/2
        (elixir 1.16.0) lib/task/supervised.ex:36: Task.Supervised.reply/4
        (stdlib 5.0) proc_lib.erl:241: :proc_lib.init_p_do_apply/3`,
      tool: "bash", command: "mix test",
    },
    expected: {
      type: "robustness",
      mustContain: ["KeyError", "key :email not found", "App.User.get_email/1", "App.Mailer.send_welcome/1", "proc_lib"],
      workflow: "swe",
    },
  },
  {
    id: "stacktrace-t3-15",
    tier: 3, category: "partial-stacktraces",
    description: ".NET stack trace with nested AggregateException",
    seed: 22015,
    input: {
      content: `System.AggregateException: One or more errors occurred. (Connection refused) (Timeout expired)
 ---> System.Net.Sockets.SocketException (111): Connection refused
   at System.Net.Sockets.Socket.AwaitableSocketAsyncEventArgs.ThrowException(SocketError error)
   at System.Net.Sockets.Socket.AwaitableSocketAsyncEventArgs.System.Threading.Tasks.Sources.IValueTaskSource.GetResult(Int16 token)
   at Microsoft.Data.SqlClient.SNI.SNITCPHandle.Connect(String serverName, Int32 port)
   --- End of inner exception stack trace ---
 ---> (Inner Exception #1) System.TimeoutException: Timeout expired. The timeout period elapsed prior to obtaining a connection from the pool.
   at Microsoft.Data.SqlClient.SqlInternalConnectionTds.LoginNoFailover()
   at Microsoft.Data.SqlClient.SqlInternalConnectionTds.OpenLoginEnlist()
   --- End of inner exception stack trace ---
   at System.Threading.Tasks.Task.ThrowIfExceptional(Boolean includeTaskCanceledExceptions)
   at App.Startup.ConfigureServices(IServiceCollection services) in /app/Startup.cs:line 45`,
      tool: "bash", command: "dotnet run",
    },
    expected: {
      type: "robustness",
      mustContain: [
        "AggregateException",
        "Connection refused",
        "Timeout expired",
        "Inner Exception #1",
        "Startup.cs:line 45",
      ],
      workflow: "swe",
    },
  },
]
