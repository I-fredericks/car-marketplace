import React from 'react';
import useSEO from '../hooks/useSEO';

const Section = ({ title, children }) => (
  <section className="mb-8">
    <h2 className="font-display font-semibold text-xl text-textprimary mb-3">{title}</h2>
    <div className="text-textsecondary leading-relaxed space-y-3 text-sm">{children}</div>
  </section>
);

const Terms = () => {
  useSEO({
    title: 'Terms of Service',
    description: 'The rules for buying, selling and using the CarMarket Ghana marketplace.',
  });

  return (
    <div className="bg-bg min-h-screen pt-28 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="font-display font-bold text-3xl text-textprimary mb-2">Terms of Service</h1>
        <p className="text-textmuted text-sm mb-10">Last updated: September 2026</p>

        <Section title="1. Agreement">
          <p>
            By using CarMarket Ghana ("CarMarket", the "platform"), you agree to these terms.
            CarMarket is a marketplace that connects private sellers, dealers and buyers of
            vehicles in Ghana. CarMarket is not a party to any sale between users.
          </p>
        </Section>

        <Section title="2. Accounts">
          <p>
            You must provide accurate information when registering and are responsible for
            keeping your credentials secure. You must be at least 18 years old to list a
            vehicle. Accounts engaging in fraud or misuse may be suspended or terminated.
          </p>
        </Section>

        <Section title="3. Listings">
          <p>
            Sellers confirm they have the legal right to sell each vehicle listed, and that
            listing details (price, mileage, condition, year, photos) are accurate and not
            misleading. Prohibited content includes stolen vehicles, vehicles with tampered
            identifiers, duplicate listings, and misrepresentation of condition or ownership.
            CarMarket reviews, approves, rejects or removes listings at its discretion.
          </p>
        </Section>

        <Section title="4. Paid plans and payments">
          <p>
            Listing plans (free tier and paid subscriptions) are billed in Ghana cedis through
            Paystack. Plan fees cover platform features — they are not commissions on sales.
            Paid plans activate after payment confirmation and remain active for the stated
            period. Fees are non-refundable except where required by law.
          </p>
        </Section>

        <Section title="5. Buying and communicating on CarMarket">
          <p>
            CarMarket facilitates contact between buyers and sellers but does not verify
            ownership, condition or roadworthiness unless a listing carries a CarMarket
            "Verified" badge, which indicates document review only and is not a warranty.
            Buyers are solely responsible for inspecting vehicles and conducting due
            diligence before paying any seller. Never transfer money for a vehicle you have
            not inspected.
          </p>
        </Section>

        <Section title="6. Acceptable use">
          <p>
            You may not use the platform to harass other users, scrape data, send spam
            messages, upload malicious files, or circumvent security controls. Messages and
            uploaded images are monitored for abuse prevention.
          </p>
        </Section>

        <Section title="7. Liability">
          <p>
            The platform is provided "as is". To the fullest extent permitted by law,
            CarMarket is not liable for losses arising from transactions between users,
            inaccurate listing content, or service interruptions.
          </p>
        </Section>

        <Section title="8. Changes">
          <p>
            We may update these terms; material changes will be announced on the platform.
            Continued use after changes take effect constitutes acceptance.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            Questions about these terms:{' '}
            <a href="mailto:support@carmarket.com.gh" className="text-primary hover:underline">support@carmarket.com.gh</a>.
          </p>
        </Section>
      </div>
    </div>
  );
};

export default Terms;
