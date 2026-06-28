import {
  Body,
  Button,
  Container,
  Column,
  Font,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BriefingItem {
  ticker:     string;
  thesis:     string;
  confidence: number;
}

export interface DailyBriefingEmailProps {
  date:    string;   // e.g. "Monday, June 30, 2026"
  buys:    BriefingItem[];
  avoids:  BriefingItem[];
  outlook: string;
  appUrl?: string;
}

// ── Color palette ─────────────────────────────────────────────────────────────

const C = {
  navy:       '#0A1628',
  gold:       '#B8960C',
  green:      '#10B981',
  greenLight: '#D1FAE5',
  red:        '#EF4444',
  redLight:   '#FEE2E2',
  gray:       '#4A5568',
  grayLight:  '#F8F9FA',
  border:     '#E2E8F0',
  white:      '#ffffff',
};

// ── Shared styles ─────────────────────────────────────────────────────────────

const styles = {
  body: {
    backgroundColor: C.grayLight,
    fontFamily:      "'Inter', Arial, Helvetica, sans-serif",
    margin:          0,
    padding:         0,
  },
  container: {
    maxWidth:        '600px',
    margin:          '0 auto',
    backgroundColor: C.white,
  },
  header: {
    backgroundColor: C.navy,
    padding:         '32px 40px 28px',
    borderBottom:    `3px solid ${C.gold}`,
  },
  logoText: {
    fontFamily:    "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    fontSize:      '13px',
    letterSpacing: '0.4em',
    textTransform: 'uppercase' as const,
    color:         C.gold,
    margin:        '0 0 12px',
  },
  headerTitle: {
    fontFamily:    "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    fontSize:      '28px',
    fontWeight:    300,
    color:         C.white,
    margin:        '0 0 6px',
    lineHeight:    '1.2',
  },
  headerDate: {
    fontSize:      '12px',
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color:         'rgba(255,255,255,0.5)',
    margin:        0,
  },
  sectionLabel: {
    fontSize:      '9px',
    letterSpacing: '0.25em',
    textTransform: 'uppercase' as const,
    fontWeight:    600,
    margin:        '0 0 16px',
    padding:       '0 40px',
  },
  sectionPadding: {
    padding: '28px 40px',
  },
  ticker: {
    fontFamily:  "'Cormorant Garamond', Georgia, serif",
    fontSize:    '22px',
    fontWeight:  600,
    margin:      '0 0 4px',
    lineHeight:  '1',
  },
  thesis: {
    fontSize:   '13px',
    lineHeight: '1.6',
    color:      C.gray,
    margin:     '0 0 12px',
  },
  confidence: {
    fontSize:      '10px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    fontWeight:    600,
    margin:        '0 0 14px',
  },
  button: {
    display:       'inline-block',
    fontSize:      '10px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    padding:       '8px 16px',
    textDecoration:'none',
    fontWeight:    600,
  },
  card: {
    borderRadius:  0,
    padding:       '20px 24px',
    marginBottom:  '12px',
  },
  outlookText: {
    fontSize:    '14px',
    lineHeight:  '1.8',
    color:       C.gray,
    textAlign:   'justify' as const,
    margin:      0,
  },
  footer: {
    backgroundColor: C.navy,
    padding:         '24px 40px',
    marginTop:       '0',
  },
  footerText: {
    fontSize:   '11px',
    color:      'rgba(255,255,255,0.35)',
    margin:     '0 0 8px',
    lineHeight: '1.6',
  },
  footerLink: {
    color:          C.gold,
    textDecoration: 'none',
  },
  divider: {
    borderColor: C.border,
    margin:      '0',
  },
};

// ── Item card ─────────────────────────────────────────────────────────────────

function BuyCard({ item, appUrl }: { item: BriefingItem; appUrl: string }) {
  const watchlistUrl = `${appUrl}/markets?ticker=${item.ticker}`;
  return (
    <Section style={{ ...styles.card, backgroundColor: C.greenLight, borderLeft: `3px solid ${C.green}` }}>
      <Text style={{ ...styles.ticker, color: C.navy }}>{item.ticker}</Text>
      <Text style={styles.thesis}>{item.thesis}</Text>
      <Text style={{ ...styles.confidence, color: C.green }}>
        {item.confidence}% confidence
      </Text>
      <Button
        href={watchlistUrl}
        style={{ ...styles.button, backgroundColor: C.green, color: C.white }}
      >
        Add to Watchlist →
      </Button>
    </Section>
  );
}

function AvoidCard({ item }: { item: BriefingItem }) {
  return (
    <Section style={{ ...styles.card, backgroundColor: C.redLight, borderLeft: `3px solid ${C.red}` }}>
      <Text style={{ ...styles.ticker, color: C.navy }}>{item.ticker}</Text>
      <Text style={styles.thesis}>{item.thesis}</Text>
      <Text style={{ ...styles.confidence, color: C.red }}>
        {item.confidence}% conviction to avoid
      </Text>
    </Section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DailyBriefingEmail({
  date,
  buys,
  avoids,
  outlook,
  appUrl = 'https://tavola.finance',
}: DailyBriefingEmailProps) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Cormorant Garamond"
          fallbackFontFamily="Georgia"
          webFont={{
            url:    'https://fonts.gstatic.com/s/cormorantgaramond/v22/BXR2vFPGjeLPh0qB7s1qHWdAXFfpuHUuDxw.woff2',
            format: 'woff2',
          }}
          fontWeight={300}
          fontStyle="normal"
        />
        <Font
          fontFamily="Cormorant Garamond"
          fallbackFontFamily="Georgia"
          webFont={{
            url:    'https://fonts.gstatic.com/s/cormorantgaramond/v22/BXR4vFPGjeLPh0qB7s1qHWdAXFfpuH4KrQ.woff2',
            format: 'woff2',
          }}
          fontWeight={600}
          fontStyle="normal"
        />
      </Head>
      <Preview>Tavola Daily Strategy: {date} — 3 buys, 3 avoids + market outlook</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* ── Header ───────────────────────────────────────────────────── */}
          <Section style={styles.header}>
            <Text style={styles.logoText}>Tavola</Text>
            <Heading as="h1" style={styles.headerTitle}>
              Daily Strategy Briefing
            </Heading>
            <Text style={styles.headerDate}>{date}</Text>
          </Section>

          {/* ── Buy recommendations ──────────────────────────────────────── */}
          <Section style={{ padding: '28px 40px 8px' }}>
            <Text style={{ ...styles.sectionLabel, color: C.green, padding: 0 }}>
              ▲ Buy Recommendations
            </Text>
          </Section>
          <Section style={{ padding: '0 40px 20px' }}>
            {buys.map((item) => (
              <BuyCard key={item.ticker} item={item} appUrl={appUrl} />
            ))}
          </Section>

          <Hr style={styles.divider} />

          {/* ── Avoid ideas ──────────────────────────────────────────────── */}
          <Section style={{ padding: '28px 40px 8px' }}>
            <Text style={{ ...styles.sectionLabel, color: C.red, padding: 0 }}>
              ▼ Avoid / Reduce
            </Text>
          </Section>
          <Section style={{ padding: '0 40px 20px' }}>
            {avoids.map((item) => (
              <AvoidCard key={item.ticker} item={item} />
            ))}
          </Section>

          <Hr style={styles.divider} />

          {/* ── Market outlook ───────────────────────────────────────────── */}
          <Section style={styles.sectionPadding}>
            <Text style={{ ...styles.sectionLabel, color: C.gold, padding: 0 }}>
              Market Outlook
            </Text>
            <Text style={styles.outlookText}>{outlook}</Text>
          </Section>

          <Hr style={styles.divider} />

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              This is AI-generated market guidance, not personalized investment advice.
              Past AI performance does not guarantee future results. All investments
              involve risk. See full briefing at{' '}
              <a href={`${appUrl}/briefing`} style={styles.footerLink}>
                tavola.finance/briefing
              </a>
            </Text>
            <Text style={{ ...styles.footerText, margin: 0 }}>
              © {new Date().getFullYear()} Tavola ·{' '}
              <a href={appUrl} style={styles.footerLink}>tavola.finance</a>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

export default DailyBriefingEmail;
