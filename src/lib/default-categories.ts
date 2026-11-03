/**
 * Categories every new account starts with. Kept in one place so signup and the
 * seed script create the same starter set (colours here double as the app's
 * universal category colours).
 */
export type DefaultCategory = {
  name: string;
  color: string;
  icon: string;
  keywords: string;
};

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Food & Dining", color: "#f97316", icon: "UtensilsCrossed", keywords: "swiggy, zomato, restaurant, cafe, dominos, pizza, mcdonald, starbucks, chaat, dhaba, biryani, kfc, burger, food" },
  { name: "Groceries", color: "#22c55e", icon: "ShoppingCart", keywords: "bigbasket, blinkit, zepto, dmart, instamart, grocery, kirana, reliance fresh, vegetables, fruits, supermarket" },
  { name: "Transport", color: "#3b82f6", icon: "Car", keywords: "uber, ola, rapido, metro, petrol, fuel, indian oil, parking, toll, fastag, rickshaw, cab" },
  { name: "Bills & Utilities", color: "#eab308", icon: "ReceiptText", keywords: "electricity, bescom, water bill, gas bill, broadband, airtel, jio, vodafone, wifi, recharge, mobile bill, dth, act fibernet" },
  { name: "Rent & Housing", color: "#a855f7", icon: "Home", keywords: "rent, society maintenance, maintenance, landlord, housing" },
  { name: "Shopping", color: "#ec4899", icon: "ShoppingBag", keywords: "amazon, flipkart, myntra, ajio, croma, reliance digital, meesho, decathlon, ikea, nykaa" },
  { name: "Health", color: "#ef4444", icon: "HeartPulse", keywords: "pharmacy, apollo, netmeds, 1mg, hospital, clinic, doctor, diagnostic, lab, medicine" },
  { name: "Entertainment", color: "#8b5cf6", icon: "Clapperboard", keywords: "netflix, prime video, hotstar, spotify, youtube, bookmyshow, pvr, inox, cinema, gaming, steam" },
  { name: "Education", color: "#14b8a6", icon: "GraduationCap", keywords: "udemy, coursera, tuition, school fee, course, books, exam fee, coaching" },
  { name: "Travel", color: "#06b6d4", icon: "Plane", keywords: "makemytrip, goibibo, redbus, oyo, hotel, airbnb, flight, indigo, vistara, air india, trip, vacation" },
  { name: "Personal Care", color: "#f43f5e", icon: "Scissors", keywords: "salon, spa, barber, gym, cult.fit, cultfit, fitness, skincare, cosmetics, parlour" },
  { name: "Investments", color: "#10b981", icon: "TrendingUp", keywords: "sip, mutual fund, zerodha, groww, upstox, stocks, ppf, nps, elss, deposit" },
  { name: "Gifts & Donations", color: "#d946ef", icon: "Gift", keywords: "gift, donation, temple, charity, ngo, festival, birthday" },
  { name: "Other", color: "#64748b", icon: "CircleEllipsis", keywords: "misc, miscellaneous" },
];
