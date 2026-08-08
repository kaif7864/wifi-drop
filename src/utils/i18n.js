/**
 * client/src/utils/i18n.js
 * WiFi Drop — Internationalization & Hinglish/Hindi Translation Dictionary
 */

export const translations = {
  en: {
    dashboard: '📊 Dashboard',
    customer_folders: '📂 Customer Folders',
    files: '📄 All Files Stream',
    texts: '📝 Text Notes',
    print: '🖨️ Print Management',
    billing: '💳 Billing & Invoicing',
    customers: '👥 Customer Management',
    analytics: '📊 Reports & Analytics',
    qr_management: '📱 QR Code Manager',
    history: '📜 Full History',
    standee: '🖼️ Counter Standee',
    settings: '⚙️ Shop Settings',
    files_today: 'Files Today',
    total_customers: 'Total Customers',
    pending_prints: 'Pending Prints',
    total_files: 'Total Files',
    quick_actions: '⚡ Quick Actions',
    recent_activity: '🕐 Recent Activity',
    save: '💾 Save',
    delete: '🗑️ Delete',
    mark_printed: '🖨️ Mark Printed',
    view: '👁️ View',
  },
  hi: {
    dashboard: '📊 डैशबोर्ड',
    customer_folders: '📂 कस्टमर फोल्डर्स',
    files: '📄 सभी फाइल्स स्ट्रीम',
    texts: '📝 टेक्स्ट नोट्स',
    print: '🖨️ प्रिंट मैनेजमेंट',
    billing: '💳 बिलिंग और बिल',
    customers: '👥 ग्राहक लिस्ट',
    analytics: '📊 रिपोर्ट और आंकड़े',
    qr_management: '📱 क्यूआर कोड मैनेजर',
    history: '📜 पुराना इतिहास',
    standee: '🖼️ काउंटर क्यूआर स्टैंडी',
    settings: '⚙️ दुकान सेटिंग्स',
    files_today: 'आज की फाइल्स',
    total_customers: 'कुल ग्राहक',
    pending_prints: 'बाकी प्रिंट्स',
    total_files: 'कुल फाइल्स',
    quick_actions: '⚡ मुख्य काम (Quick Actions)',
    recent_activity: '🕐 हाल की गतिविधियां',
    save: '💾 सेव करें',
    delete: '🗑️ डिलीट करें',
    mark_printed: '🖨️ प्रिंट हो गया',
    view: '👁️ देखें',
  },
};

export function t(key, lang = 'en') {
  return translations[lang]?.[key] || translations['en'][key] || key;
}
