import "./AboutPage.css";

export default function AboutPage() {
  const sdpLogoUrl = `${import.meta.env.BASE_URL}sdp-logo-3.png`;
  const teamMembers = [
    "Alec Conn",
    "Alexander Daniluc",
    "Thomas Pengelly",
    "Jackson Price",
    "Schylar Davis",
  ];

  return (
    <section className="about-page" aria-labelledby="about-title">
      <div className="about-container">
        <div className="about-card">
          {/* SDP Branding Header */}
          <div className="about-header">
            <a href="https://sdp.boisestate.edu/" target="_blank" rel="noopener noreferrer" className="sdp-logo-link">
              <img src={sdpLogoUrl} alt="Senior Design Project - Boise State University" className="sdp-logo" />
            </a>
            <h1 id="about-title">About</h1>
            <p className="about-subtitle">Boise State University • Senior Design Project</p>
          </div>

          {/* Overview */}
          <section className="about-section">
            <p>
              Built by Boise State University senior students as part of the Senior Design Project, this web application streamlines housing and bed assignment management for the Idaho Department of Correction, enabling efficient coordination between correctional staff and housing providers.
            </p>
          </section>

          {/* Features */}
          <section className="about-section">
            <h2>Features</h2>
            <ul className="features-list">
              <li>Bed assignment tracking across multiple facilities</li>
              <li>Role-based access control</li>
              <li>Parolee placement management</li>
              <li>Secure authentication and password management</li>
            </ul>
          </section>

          {/* Team */}
          <section className="about-section">
            <h2>Development Team</h2>
            <div className="team-list">
              {teamMembers.map((name, index) => (
                <p key={index} className="team-name">{name}</p>
              ))}
            </div>
          </section>

          <div className="about-footer">
            <a href="/login" className="back-to-login-button">Back to Login</a>
          </div>
        </div>
      </div>
    </section>
  );
}
