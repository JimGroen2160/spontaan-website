const LEDENADMINISTRATIE_URL =
  'https://spontaan-angerlo.nl/admin/index.html'

export function LedenadministratiePane() {
  return (
    <main
      style={{
        maxWidth: '52rem',
        padding: '2rem',
      }}
    >
      <p
        style={{
          color: '#6b2d76',
          fontSize: '0.875rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          margin: '0 0 0.5rem',
          textTransform: 'uppercase',
        }}
      >
        PRODUCTIE
      </p>

      <h1
        style={{
          fontSize: '2rem',
          lineHeight: 1.2,
          margin: '0 0 1rem',
        }}
      >
        Ledenadministratie
      </h1>

      <p
        style={{
          fontSize: '1rem',
          lineHeight: 1.6,
          margin: '0 0 1rem',
        }}
      >
        Leden en persoonsgegevens worden niet in Sanity beheerd.
        Gebruik hiervoor de aparte beveiligde ledenadministratie.
      </p>

      <p
        style={{
          fontSize: '1rem',
          lineHeight: 1.6,
          margin: '0 0 1.5rem',
        }}
      >
        Onderstaande knop opent de beveiligde ledenadministratie
        van Spontaan in de productieomgeving.
      </p>

      <a
        href={LEDENADMINISTRATIE_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: '#d1008f',
          borderRadius: '0.375rem',
          color: '#ffffff',
          display: 'inline-block',
          fontWeight: 700,
          padding: '0.75rem 1rem',
          textDecoration: 'none',
        }}
      >
        Open Ledenadministratie
      </a>

      <p
        style={{
          color: '#5f5965',
          fontSize: '0.875rem',
          lineHeight: 1.5,
          margin: '1rem 0 0',
        }}
      >
        De ledenadministratie opent in een nieuw tabblad.
        Gebruik daarvoor het afzonderlijke Ledenadministratie
        account; de Sanity-login is hiervan gescheiden.
      </p>
    </main>
  )
}
