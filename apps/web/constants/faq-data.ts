export interface FAQ {
  question: string;
  answer: string;
}

export interface FAQCategory {
  category: string;
  icon: string;
  faqs: FAQ[];
}

export const faqData: FAQCategory[] = [
  {
    category: "Ordering & Payment",
    icon: "ShoppingCart",
    faqs: [
      {
        question: "How do I place an order?",
        answer:
          "Browse our products, add items to your cart, and proceed to checkout. You can pay via Cash on Delivery, bKash, Nagad, or Bank Transfer.",
      },
      {
        question: "What payment methods do you accept?",
        answer:
          "We accept Cash on Delivery (COD), bKash, Nagad, Bank Transfer, and Credit/Debit Cards for B2B customers.",
      },
      {
        question: "Can I modify my order after placing it?",
        answer:
          "You can request modifications while your order is still in 'Pending' status. Contact our support team or your assigned salesman for assistance.",
      },
      {
        question: "Is there a minimum order quantity?",
        answer:
          "Minimum order quantities vary by product. Check the product details page for specific MOQ requirements.",
      },
    ],
  },
  {
    category: "Shipping & Delivery",
    icon: "Truck",
    faqs: [
      {
        question: "How long does delivery take?",
        answer:
          "Standard delivery takes 2-5 business days within Dhaka and 5-7 business days for other districts. Express delivery options are available.",
      },
      {
        question: "How can I track my order?",
        answer:
          "Go to 'My Orders' in your account, click on the order, and select 'Track Order' to see real-time delivery updates.",
      },
      {
        question: "Do you deliver outside Dhaka?",
        answer:
          "Yes, we deliver nationwide across Bangladesh. Shipping costs and delivery times may vary by location.",
      },
      {
        question: "What if I'm not available during delivery?",
        answer:
          "Our delivery team will contact you before arrival. If you're unavailable, they'll reschedule for a convenient time.",
      },
    ],
  },
  {
    category: "Returns & Refunds",
    icon: "RotateCcw",
    faqs: [
      {
        question: "What is your return policy?",
        answer:
          "You can request returns within 7 days of delivery for defective or incorrect items. Items must be unused and in original packaging.",
      },
      {
        question: "How do I initiate a return?",
        answer:
          "Go to 'My Orders', select the order, and click 'Request Return'. Our team will process your request within 24 hours.",
      },
      {
        question: "When will I receive my refund?",
        answer:
          "Refunds are processed within 5-7 business days after the returned item is received and inspected. Credit will be issued to your original payment method.",
      },
      {
        question: "Can I exchange an item instead of returning?",
        answer:
          "Yes, exchanges are available for size or variant changes. Contact support with your order details to arrange an exchange.",
      },
    ],
  },
  {
    category: "Account & Security",
    icon: "Shield",
    faqs: [
      {
        question: "How do I reset my password?",
        answer:
          "Click 'Forgot Password' on the login page, enter your email, and follow the reset link sent to your inbox.",
      },
      {
        question: "How do I update my business information?",
        answer:
          "Go to Account Settings to update your shop name, address, and contact information. Some changes may require verification.",
      },
      {
        question: "Is my payment information secure?",
        answer:
          "Yes, we use industry-standard encryption and secure payment gateways. We never store full card details on our servers.",
      },
      {
        question: "Can I have multiple users on my business account?",
        answer:
          "Currently, each account supports a single user. For team access, contact our enterprise sales team.",
      },
    ],
  },
];
