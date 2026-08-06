type ItemsResponse<T> = readonly T[] | { readonly items?: readonly T[] | null } | null | undefined;

export function itemsOf<T>(response: ItemsResponse<T>): T[] {
  if (Array.isArray(response)) {
    return [...response] as T[];
  }

  if (response && typeof response === 'object' && 'items' in response && Array.isArray(response.items)) {
    return [...response.items];
  }

  return [];
}
