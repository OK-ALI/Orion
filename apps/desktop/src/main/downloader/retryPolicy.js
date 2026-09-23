// Required fragments must fail the transfer rather than producing a partial file.
const YT_DLP_RETRY_ARGS = Object.freeze([
  "--retries", "2",
  "--fragment-retries", "2",
  "--retry-sleep", "fragment:exp=1:15",
  "--socket-timeout", "30",
]);

module.exports = { YT_DLP_RETRY_ARGS };
