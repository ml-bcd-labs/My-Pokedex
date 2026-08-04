interface IProps {
  html: string;
  ariaLabel: string;
  className: string;
}

// De-hydrated counterpart to BrowseIndex: renders prebuilt <details> markup
// (produced at build time via renderToStaticMarkup(<BrowseIndexContent/>))
// as an opaque dangerouslySetInnerHTML island. React never reconciles the
// ~1,000 anchors inside — it just drops the HTML in and leaves it alone —
// which is what removes them from the hydration long task on the home page.
// suppressHydrationWarning tells React the server/client mismatch (there IS
// no client-rendered subtree to compare against) is intentional.
const BrowseIndexStatic = ({ html, ariaLabel, className }: IProps) => (
  <nav
    className={className}
    aria-label={ariaLabel}
    dangerouslySetInnerHTML={{ __html: html }}
    suppressHydrationWarning
  />
);

export default BrowseIndexStatic;
