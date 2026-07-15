export function interpolateTranslation(
  template: string,
  variables?: Record<string, string | number>,
): string {
  if (!variables) return template;

  return Object.entries(variables).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
    template,
  );
}
