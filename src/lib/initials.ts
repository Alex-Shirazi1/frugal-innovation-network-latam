/**
 * Avatar initials for a member.
 *
 * Takes the first letter of the first two words. With the name stored whole
 * rather than split, there is no reliable way to find the surname: Spanish
 * names routinely carry two given names and two surnames, so "María Fernanda
 * Gómez Ruiz" could correctly initialise as MG, MF, or MR depending on where
 * the given names stop — and nothing in the string says.
 *
 * First-two-words is chosen because it is right for the common two-word case
 * and never surprising for longer ones, and because the alternative
 * (first word + last word) reaches for the *second* surname, which is the part
 * a person is least often known by.
 *
 * This is decoration on a coloured circle, not identity. It should never be
 * used to sort, match, or address anybody.
 */
export function initialsOf(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
}
