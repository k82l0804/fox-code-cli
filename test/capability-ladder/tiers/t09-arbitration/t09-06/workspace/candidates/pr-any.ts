export function parseUserProfile(data: any): any {
  return { id: (data as any).id, name: (data as any).name, email: (data as any).email };
}
