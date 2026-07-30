import Header from "../ui/components/Header/Header";
import Page from "../ui/templates/Page/Page";
import LegalLayout from "../ui/components/LegalLayout/LegalLayout";
import { SITE_NAME } from "../constants/Seo";
import { hreflangAlternates } from "../utils/hreflang";

const PrivacyPage = () => (
  <>
    <Header
      title={`Privacy Policy — No Cookies, No Ads, No Tracking | ${SITE_NAME}`}
      description={`How ${SITE_NAME} handles your data: no cookies, no advertising, no analytics and no third-party tracking. What the site stores locally and what it never collects.`}
      canonicalPath="/privacy"
      alternates={hreflangAlternates("/privacy", "/fr/privacy")}
    />
    <Page>
      <LegalLayout heading="Privacy Policy" updated="July 13, 2026">
        <p>
          This Privacy Policy explains how {SITE_NAME}{" "}(&quot;we&quot;, &quot;us&quot;)
          handles information when you visit this site.
        </p>

        <h2>No cookies, advertising, or analytics</h2>
        <p>
          We do not use cookies, we do not display advertising, and we do not run any
          analytics or visitor tracking. No third-party tracking or advertising
          scripts are loaded, and we do not collect personal data about you.
        </p>
        <p>
          Some technical data (such as your IP address and browser user-agent) may be
          processed transiently by our hosting provider to deliver pages, as is
          normal for any website. This data is not used to identify or track you.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy? See our <a href="/contact">contact page</a>.
        </p>
      </LegalLayout>
    </Page>
  </>
);

export default PrivacyPage;
