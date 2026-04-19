export const SublyLogo = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="10" fill="#00274C" />
    <circle cx="16" cy="17" r="6" stroke="#FFCB05" strokeWidth="2.5" fill="none" />
    <line x1="20.2" y1="21.2" x2="28" y2="29" stroke="#FFCB05" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="25" y1="26" x2="25" y2="29" stroke="#FFCB05" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="22.5" y1="28" x2="28" y2="28" stroke="#FFCB05" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
)

export const SublyWordmark = ({ size = 32, light = false, onClick }) => (
  <div
    onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: onClick ? 'pointer' : 'default' }}>
    <SublyLogo size={size} />
    <span style={{
      fontSize: size * 0.5,
      fontWeight: 800,
      color: light ? '#fff' : '#00274C',
      letterSpacing: '-0.04em',
      fontFamily: "'Inter', sans-serif",
    }}>
      Subly
    </span>
  </div>
)
