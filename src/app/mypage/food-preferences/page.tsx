import { redirect } from 'next/navigation'

// This intermediate page has been superseded by the preference card chips
// displayed directly on /mypage. Preserve the URL for existing bookmarks/links.
export default function FoodPreferencesRedirect() {
  redirect('/mypage')
}
