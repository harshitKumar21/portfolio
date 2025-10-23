# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a BMW-inspired portfolio website featuring horizontal scrolling navigation and modern animations. It's a pure vanilla web project (no build system) with a focus on performance and visual excellence.

**Tech Stack:**
- HTML5 with semantic markup
- CSS3 with advanced animations and custom properties
- Vanilla JavaScript (ES6+) with modern classes
- Google Fonts (Inter family)
- No dependencies or build tools

## Development Commands

Since this is a static website with no build system, development is straightforward:

```bash
# Serve the project locally (use any static server)
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (if you have http-server installed)
npx http-server . -p 8000

# PHP
php -S localhost:8000

# Then open http://localhost:8000
```

**Testing:** Open `index.html` directly in a browser or use any static file server.

**Deployment:** Upload all files to any static hosting service (Netlify, Vercel, GitHub Pages, etc.).

## Architecture

### File Structure
```
bmw-inspired-portfolio/
├── index.html          # Main HTML with all sections
├── css/
│   └── style.css       # Single comprehensive stylesheet
├── js/
│   └── main.js         # Complete JavaScript functionality
└── README.md
```

### Core Architecture Patterns

**1. Section-Based Layout**
- Each section is `100vw` wide in a horizontal flex container
- Navigation works by translating the main container (`translateX`)
- Sections: Hero, About, Projects, Skills, Contact

**2. Class-Based JavaScript Architecture**
- `HorizontalPortfolio`: Main orchestrator class handling navigation and state
- `SmoothScrolling`: Utility for smooth transitions
- `PerformanceOptimizer`: RAF-based performance optimization
- `LoadingManager`: Handles initial page load states
- `ContactForm`: Form submission handling
- `Utils`: Utility functions (debounce, throttle, etc.)

**3. Animation System**
- CSS-based animations with JavaScript triggers
- Intersection Observer for scroll-triggered animations
- Section-specific animation states (`.active`, `.in-viewport`, `.animate-in`)
- Hardware acceleration via `transform` and `will-change`

**4. Navigation System**
- Multi-input support: wheel events, touch gestures, keyboard
- Progress indicators: horizontal progress bar and dot navigation
- URL-based section targeting via navigation links

## Key Components

### HorizontalPortfolio Class
The main controller handling all navigation logic:
- **State Management**: Tracks current section, scroll state
- **Event Handling**: Unified handling for mouse, touch, keyboard
- **Animation Coordination**: Section transitions and progress updates
- **DOM Updates**: Active states, transforms, progress indicators

### CSS Animation Architecture
- **Custom Properties**: Color scheme in CSS variables
- **Animation Timing**: Consistent cubic-bezier curves
- **Performance**: GPU acceleration, reduced motion support
- **Responsive**: Grid-based layouts with mobile adaptations

### Section Structure Pattern
Each section follows this pattern:
- `.section-header` with number and title
- `.content` wrapper for responsive containment
- Section-specific content grids
- Animated elements with staggered delays

## Development Guidelines

### Adding New Sections
1. Add section HTML with proper ID and classes
2. Update `totalSections` calculation in JavaScript
3. Add corresponding dot indicator
4. Implement section-specific animations in CSS
5. Add navigation link if needed

### Customizing Animations
- Modify CSS custom properties for timing
- Update animation delays in JavaScript
- Use existing animation classes (`.active`, `.animate-in`)
- Maintain consistent easing curves

### Performance Considerations
- All animations use `transform` and `opacity` only
- Intersection Observer prevents unnecessary calculations
- RAF-based optimization for smooth performance
- Debounced/throttled event handlers

## Color System

BMW-inspired color palette defined in CSS:
```css
Primary Blue: #007aff
Secondary Purple: #5856d6
Dark Background: #0a0a0a
Secondary Dark: #1a1a1a
Text Primary: #ffffff
Text Secondary: rgba(255, 255, 255, 0.8)
```

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Touch and Accessibility

- Full touch gesture support (swipe navigation)
- Keyboard navigation (arrow keys, Home/End)
- Reduced motion preference support
- Semantic HTML structure
- ARIA-compatible navigation

## Form Handling

Contact form includes basic validation and submission simulation. For production:
1. Replace form submission logic in `ContactForm.handleSubmit()`
2. Add proper backend endpoint
3. Implement error handling and validation
4. Consider adding CSRF protection

## Performance Notes

- No external dependencies (only Google Fonts)
- Hardware-accelerated animations
- Optimized for 60fps performance
- Lazy loading considerations built-in
- Mobile-optimized touch handling