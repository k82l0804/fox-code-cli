// BUG: Eager module-level evaluation reads process.env before test sets it
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

export function getPort(): number {
  return PORT;
}
