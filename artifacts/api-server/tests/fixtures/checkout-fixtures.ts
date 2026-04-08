export type CheckoutFixture = {
  id: string;
  domain: string;
  url: string;
  pageText: string;
  buttonLabels: string[];
  priceStrings: string[];
  timerElements?: string[];
  stockAlerts?: string[];
  expected: {
    isShoppingPage: boolean;
    pageType: "non_commerce" | "product" | "cart" | "checkout";
    minPatterns?: number;
    trustScoreAtMost?: number;
    trustScoreAtLeast?: number;
    hiddenFees?: boolean;
    urgency?: boolean;
    scarcity?: boolean;
    preCheckedAddOns?: boolean;
  };
};

export const checkoutFixtures: CheckoutFixture[] = [
  {
    id: "hotel-manipulative-booking",
    domain: "booking.com",
    url: "https://booking.com/hotel/paradise-resort/checkout",
    pageText:
      "DEAL EXPIRES IN 00:04:59. Only 1 room left at this price. 14 other people are viewing this room. Travel Protection Insurance [PRE-CHECKED] $24.99. Mandatory service fee shown at final page only. No thanks, I don't care about getting the best deal.",
    buttonLabels: ["Reserve now", "Continue to payment"],
    priceStrings: ["$495.00", "$24.99"],
    timerElements: ["Deal expires in 00:04:59"],
    stockAlerts: ["Only 1 room left at this price", "14 people are viewing this room"],
    expected: {
      isShoppingPage: true,
      pageType: "checkout",
      minPatterns: 4,
      trustScoreAtMost: 45,
      hiddenFees: true,
      urgency: true,
      scarcity: true,
      preCheckedAddOns: true,
    },
  },
  {
    id: "airline-upsell-united",
    domain: "united.com",
    url: "https://united.com/checkout/seats",
    pageText:
      "Price lock ends in 12:34. Premium Economy seats ONLY 3 REMAINING. TravelGuard Premium Protection [PRE-CHECKED] $42.99. Airport Fast Track [PRE-CHECKED] $19.99. Continue to baggage. I accept the risk of traveling without protection.",
    buttonLabels: ["Continue to baggage", "Select seats"],
    priceStrings: ["$189.00", "$42.99", "$19.99"],
    timerElements: ["Price lock ends in 12:34"],
    stockAlerts: ["ONLY 3 REMAINING"],
    expected: {
      isShoppingPage: true,
      pageType: "checkout",
      minPatterns: 4,
      trustScoreAtMost: 50,
      urgency: true,
      scarcity: true,
      preCheckedAddOns: true,
    },
  },
  {
    id: "marketplace-clean-etsy",
    domain: "etsy.com",
    url: "https://etsy.com/checkout",
    pageText:
      "Item price $28.00. Shipping $4.50. Tax $2.38. Order Total $34.88. Place order. No subscriptions. No add-ons. No hidden fees.",
    buttonLabels: ["Place order", "Go back to cart"],
    priceStrings: ["$28.00", "$4.50", "$2.38", "$34.88"],
    expected: {
      isShoppingPage: true,
      pageType: "checkout",
      minPatterns: 0,
      trustScoreAtLeast: 80,
      hiddenFees: false,
      urgency: false,
      scarcity: false,
      preCheckedAddOns: false,
    },
  },
  {
    id: "non-commerce-github",
    domain: "github.com",
    url: "https://github.com/openai/openai-node",
    pageText:
      "Repository home with issues, pull requests, releases, and actions. Contribute code and inspect project files.",
    buttonLabels: ["Code", "Issues", "Pull requests"],
    priceStrings: [],
    expected: {
      isShoppingPage: false,
      pageType: "non_commerce",
      minPatterns: 0,
      trustScoreAtLeast: 90,
    },
  },
];
