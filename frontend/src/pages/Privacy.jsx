import React from 'react';
import useSEO from '../hooks/useSEO';

const Section = ({ title, children }) => (
  <section className="mb-8">
    <h2 className="font-display font-semibold text-xl text-textprimary mb-3">{title}</h2>
    <div className="text-textsecondary leading-relaxed space-y-3 text-sm">{children}</div>
  </section>
);

const Privacy = () => {
  useSEO({
    title: 'Privacy Policy',
    description: 'How CarMarket Ghana collects, uses and protects your personal data.',
  });

  return (
    <div className="bg-bg min-h-screen pt-28 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="font-display font-bold text-3xl text-textprimary mb-2">Privacy Policy</h1>
        <p className="text-textmuted text-sm mb-10">Last updated: September 2026</p>

        <Section title="1. Who we are">
          <p>
            CarMarket Ghana ("CarMarket", "we", "us") is an online marketplace that connects
            car buyers and sellers in Ghana. This policy explains what personal data we
            collect, why we collect it, and the choices you have.
          </p>
        </Section>

        <Section title="2. Data we collect">
          <p><strong>Account data:</strong> your name, email address, phone number and password (stored only as a secure hash).</p>
          <p><strong>Listing data:</strong> details, descriptions, photos and documents you upload for vehicles you list.</p>
          <p><strong>Messaging data:</strong> messages you send to other users through the platform.</p>
          <p><strong>Payment data:</strong> payments for listing plans are processed by Paystack. We never see or store your full card details; we retain only the payment reference, amount and status.</p>
          <p><strong>Technical data:</strong> IP address, browser type and basic usage logs used for security (e.g. rate limiting) and troubleshooting.</p>
        </Section>

        <Section title="3. How we use your data">
          <p>To create and manage your account; to publish and moderate listings; to deliver messages and notifications between buyers and sellers; to process plan payments; to detect fraud and abuse; and to improve the marketplace.</p>
        </Section>

        <Section title="4. Sharing your data">
          <p>
            We do not sell your personal data. We share data only with: payment processors
            (Paystack), infrastructure providers that host our servers and storage, and law
            enforcement where we are legally required. Your publicly displayed contact details
            (name, phone) are shown to other users only in the context of your listings and
            conversations, as needed for the marketplace to function.
          </p>
        </Section>

        <Section title="5. Data retention">
          <p>
            We keep your account and listing data while your account is active. Vehicle
            documents are retained to support verification and dispute resolution. You may
            request deletion of your account and personal data at any time (see section 8);
            we retain limited records where required for legal, tax or fraud-prevention
            purposes.
          </p>
        </Section>

        <Section title="6. Cookies">
          <p>We use a small number of essential cookies/local storage entries to keep you signed in. We do not use advertising or third-party tracking cookies.</p>
        </Section>

        <Section title="7. Your rights">
          <p>
            Under Ghana's Data Protection Act, 2012 (Act 843), you may request access to your
            personal data, correction of inaccurate data, and deletion of your data. You may
            also withdraw consent for marketing communications at any time.
          </p>
        </Section>

        <Section title="8. Contact us">
          <p>
            For privacy questions, data access or deletion requests, email{' '}
            <a href="mailto:support@carmarket.com.gh" className="text-primary hover:underline">support@carmarket.com.gh</a>.
            We respond to requests within 30 days.
          </p>
        </Section>
      </div>
    </div>
  );
};

export default Privacy;
