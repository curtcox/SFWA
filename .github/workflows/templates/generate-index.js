#!/usr/bin/env node

/**
 * Generates a site index page for GitHub Pages
 * Lists all HTML files with their titles and descriptions
 */

const fs = require('fs');
const path = require('path');

const SITE_DIR = process.argv[2] || '_site';
const OUTPUT_FILE = path.join(SITE_DIR, 'site-index.html');

/**
 * Extract title from HTML file
 */
function extractTitle(htmlContent, filename) {
  // Try to find <title> tag first
  const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1].trim() && titleMatch[1].trim().toLowerCase() !== 'title placeholder') {
    return titleMatch[1].trim();
  }
  
  // Try to find first <h1> tag
  const h1Match = htmlContent.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match && h1Match[1].trim()) {
    return h1Match[1].trim();
  }
  
  // Fall back to filename without extension
  return path.basename(filename, '.html');
}

/**
 * Extract description from HTML file
 */
function extractDescription(htmlContent) {
  // Try to find meta description
  const metaMatch = htmlContent.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (metaMatch && metaMatch[1].trim()) {
    return metaMatch[1].trim();
  }
  
  // Try to find first <p> tag
  const pMatch = htmlContent.match(/<p[^>]*>([^<]+)<\/p>/i);
  if (pMatch && pMatch[1].trim()) {
    const desc = pMatch[1].trim();
    // Truncate if too long
    return desc.length > 150 ? desc.substring(0, 147) + '...' : desc;
  }
  
  return '';
}

/**
 * Recursively find all HTML files in a directory
 */
function findHtmlFiles(dir, baseDir = dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip the base directory itself and hidden directories
      if (entry.name !== '.' && !entry.name.startsWith('.')) {
        files.push(...findHtmlFiles(fullPath, baseDir));
      }
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      // Skip index.html and site-index.html itself
      if (entry.name !== 'index.html' && entry.name !== 'site-index.html') {
        const relativePath = path.relative(baseDir, fullPath);
        files.push(relativePath);
      }
    }
  }
  
  return files;
}

/**
 * Generate the site index HTML
 */
function generateIndex() {
  console.log(`Scanning directory: ${SITE_DIR}`);
  
  if (!fs.existsSync(SITE_DIR)) {
    console.error(`Error: Directory ${SITE_DIR} does not exist`);
    process.exit(1);
  }
  
  // Find all HTML files
  const htmlFiles = findHtmlFiles(SITE_DIR);
  console.log(`Found ${htmlFiles.length} HTML files`);
  
  // Extract metadata from each file
  const pages = [];
  for (const file of htmlFiles) {
    const fullPath = path.join(SITE_DIR, file);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const title = extractTitle(content, file);
      const description = extractDescription(content);
      
      pages.push({
        path: file.replace(/\\/g, '/'), // Normalize path separators
        title,
        description
      });
    } catch (err) {
      console.error(`Error reading ${file}:`, err.message);
    }
  }
  
  // Sort pages by title
  pages.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
  
  // Generate HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Site Index - SFWA Collection</title>
    <meta name="description" content="Index of Single-File Web Apps (SFWA) - A collection of self-contained web applications">
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }
        
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        
        header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        header p {
            font-size: 1.1em;
            opacity: 0.95;
        }
        
        .stats {
            background: rgba(255, 255, 255, 0.15);
            padding: 15px;
            margin-top: 20px;
            border-radius: 8px;
            display: inline-block;
        }
        
        .stats strong {
            font-size: 2em;
            display: block;
        }
        
        .content {
            padding: 40px;
        }
        
        .search-box {
            margin-bottom: 30px;
            position: relative;
        }
        
        .search-box input {
            width: 100%;
            padding: 15px 20px;
            font-size: 1.1em;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            outline: none;
            transition: border-color 0.3s;
        }
        
        .search-box input:focus {
            border-color: #667eea;
        }
        
        .apps-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 25px;
        }
        
        .app-card {
            background: white;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            padding: 25px;
            transition: all 0.3s ease;
            text-decoration: none;
            color: inherit;
            display: block;
            position: relative;
            overflow: hidden;
        }
        
        .app-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transform: scaleX(0);
            transition: transform 0.3s ease;
        }
        
        .app-card:hover {
            border-color: #667eea;
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.2);
            transform: translateY(-2px);
        }
        
        .app-card:hover::before {
            transform: scaleX(1);
        }
        
        .app-card h3 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 1.3em;
            font-weight: 600;
        }
        
        .app-card p {
            color: #666;
            font-size: 0.95em;
            line-height: 1.5;
            margin-bottom: 15px;
            min-height: 40px;
        }
        
        .app-card .path {
            font-size: 0.85em;
            color: #999;
            font-family: 'Monaco', 'Courier New', monospace;
        }
        
        .no-results {
            text-align: center;
            padding: 60px 20px;
            color: #999;
        }
        
        .no-results h2 {
            font-size: 2em;
            margin-bottom: 10px;
        }
        
        footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #666;
            border-top: 1px solid #e0e0e0;
        }
        
        footer a {
            color: #667eea;
            text-decoration: none;
        }
        
        footer a:hover {
            text-decoration: underline;
        }
        
        @media (max-width: 768px) {
            .apps-grid {
                grid-template-columns: 1fr;
            }
            
            header h1 {
                font-size: 2em;
            }
            
            .content {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🚀 SFWA Collection</h1>
            <p>Single-File Web Apps - Self-contained, portable web applications</p>
            <div class="stats">
                <strong>${pages.length}</strong>
                <span>Available Apps</span>
            </div>
        </header>
        
        <div class="content">
            <div class="search-box">
                <input 
                    type="text" 
                    id="searchInput" 
                    placeholder="Search apps by name or description..." 
                    autocomplete="off"
                />
            </div>
            
            <div class="apps-grid" id="appsGrid">
                ${pages.map(page => `
                <a href="${escapeHtml(page.path)}" class="app-card" data-title="${escapeHtml(page.title.toLowerCase())}" data-description="${escapeHtml(page.description.toLowerCase())}">
                    <h3>${escapeHtml(page.title)}</h3>
                    ${page.description ? `<p>${escapeHtml(page.description)}</p>` : '<p>Click to explore this app</p>'}
                    <div class="path">${escapeHtml(page.path)}</div>
                </a>
                `).join('\n                ')}
            </div>
            
            <div class="no-results" id="noResults" style="display: none;">
                <h2>No apps found</h2>
                <p>Try a different search term</p>
            </div>
        </div>
        
        <footer>
            <p>
                <strong>About SFWA:</strong> Single-File Web Apps are self-contained HTML applications that include all their code in one file.
                State is stored in the URL hash, making them easily shareable and portable.
            </p>
            <p style="margin-top: 15px;">
                <a href="index.html">← Back to README</a> | 
                <a href="https://github.com/curtcox/SFWA" target="_blank">View on GitHub</a>
            </p>
        </footer>
    </div>
    
    <script>
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const appsGrid = document.getElementById('appsGrid');
        const noResults = document.getElementById('noResults');
        const appCards = appsGrid.querySelectorAll('.app-card');
        
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            let visibleCount = 0;
            
            appCards.forEach(card => {
                const title = card.dataset.title;
                const description = card.dataset.description;
                const matches = title.includes(searchTerm) || description.includes(searchTerm);
                
                if (matches) {
                    card.style.display = 'block';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });
            
            if (visibleCount === 0) {
                appsGrid.style.display = 'none';
                noResults.style.display = 'block';
            } else {
                appsGrid.style.display = 'grid';
                noResults.style.display = 'none';
            }
        });
        
        // Focus search on "/" key
        document.addEventListener('keydown', function(e) {
            if (e.key === '/' && document.activeElement !== searchInput) {
                e.preventDefault();
                searchInput.focus();
            }
        });
    </script>
</body>
</html>`;
  
  // Write the file
  fs.writeFileSync(OUTPUT_FILE, html, 'utf8');
  console.log(`\nSite index generated successfully: ${OUTPUT_FILE}`);
  console.log(`Total pages indexed: ${pages.length}`);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Run the script
generateIndex();
