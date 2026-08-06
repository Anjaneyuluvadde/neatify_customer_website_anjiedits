const fs = require('fs');
let c = fs.readFileSync('src/pages/ServiceDetail.jsx', 'utf8');

c = c.replace(/import \{\s*FaToilet,[\s\S]*?\} from "react-icons\/fa6";\n/, '');

c = c.replace(/\s*const getHowItWorksSteps = \(\) => \{[\s\S]*?\s*const getIconComponent = \(iconName\) => \{[\s\S]*?  \};\n/, '');

c = c.replace(/<ScrollReveal direction=\{scrollDirection\}>\n\s*<h3 className="how-it-works-title">How it works<\/h3>[\s\S]*?<\/ScrollReveal>/, 
`{service.gallery_images?.length > 0 && (
            <ScrollReveal direction={scrollDirection}>
              <h3 className="sectionTitle">Workframes</h3>
              <div className="gallery">
                {service.gallery_images.map((img, idx) => (
                  <img
                    key={idx}
                    src={getAbsoluteImageUrl(img)}
                    alt={\`Workframe \${idx + 1}\`}
                    onClick={() => setActiveLightboxImage(img)}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </div>
            </ScrollReveal>
          )}`);

fs.writeFileSync('src/pages/ServiceDetail.jsx', c);
console.log('Done!');
