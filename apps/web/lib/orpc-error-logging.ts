export function shouldLogRpcResponseAsError(status: number) {
  return status >= 500;
}
