# Living World Stories - Revolutionary News Platform

A global news platform with evolving story threads, country-by-country organization, and DNA code tracking system.

## 🌟 Features

- **DNA Code System**: Each article gets a unique identifier (e.g., `USA-POL-2025-001`)
- **Story Threading**: Related articles are automatically linked across time and countries
- **Country-Based Organization**: News organized by 5 major nations (USA, Russia, India, China, Japan)
- **8 Category System**: Politics, Economy, Society, Technology, Environment, Health, Sports, Security
- **Interactive Map**: Visual country selection with real-time statistics
- **Modern UI**: Beautiful, responsive design with smooth animations

## 🛠 Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Prisma ORM, PostgreSQL
- **AI Processing**: LangChain with OpenAI GPT-4
- **Web Scraping**: Bright Data MCP (Model Context Protocol)
- **Styling**: Tailwind CSS with custom design system

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- OpenAI API key
- Bright Data account (optional for scraping)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd living-world-stories
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Fill in your environment variables:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/living_world_stories"
   OPENAI_API_KEY="your_openai_api_key_here"
   BRIGHT_DATA_API_KEY="your_bright_data_api_key"
   BRIGHT_DATA_USERNAME="your_bright_data_username"
   BRIGHT_DATA_PASSWORD="your_bright_data_password"
   ```

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

## 🏗 Project Structure

```
src/
├── app/                    # Next.js 15 app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Homepage
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Header.tsx         # Main navigation
│   ├── CountryMap.tsx     # Interactive world map
│   ├── NewsFeed.tsx       # News article feed
│   ├── NewsCard.tsx       # Individual article card
│   ├── StoryThread.tsx    # Story threading UI
│   └── CategoryFilter.tsx # Category filtering
├── lib/                   # Utility libraries
│   ├── brightdata-mcp.ts  # Bright Data integration
│   └── langchain-agents.ts # AI processing agents
└── prisma/
    └── schema.prisma      # Database schema
```

## 🧬 DNA Code System

Each news article receives a unique DNA code following this format:

```
COUNTRY-CATEGORY-YEAR-SEQUENCE
```

**Examples:**
- `USA-POL-2025-001` - First US politics story of 2025
- `CHINA-TEC-2025-042` - 42nd China technology story of 2025
- `INDIA-ENV-2025-007` - 7th India environment story of 2025

## 📊 Categories

| Code | Category | Description |
|------|----------|-------------|
| POL  | Politics & Governance | Government, elections, policy, diplomacy |
| ECO  | Economy & Business | Markets, trade, finance, companies |
| SOC  | Society & Culture | Social issues, culture, education, lifestyle |
| TEC  | Technology & Science | Tech innovations, research, digital trends |
| ENV  | Environment & Climate | Climate change, sustainability, nature |
| HEA  | Health & Medicine | Healthcare, medical research, public health |
| SPO  | Sports & Entertainment | Sports, movies, music, celebrities |
| SEC  | Security & Conflict | Military, terrorism, conflicts, crime |

## 🔗 Story Threading

The platform automatically identifies related stories using AI analysis:

- **Same Topic**: Articles covering the same event or subject
- **Chronological Flow**: Updates and developments over time  
- **Geographic Relevance**: Related stories across different countries
- **Key Players**: Same people or organizations involved

## 🌍 Supported Countries

- 🇺🇸 **United States** - Major news sources and comprehensive coverage
- 🇷🇺 **Russia** - Regional and international news
- 🇮🇳 **India** - South Asian perspective and developments
- 🇨🇳 **China** - East Asian news and global impact stories
- 🇯🇵 **Japan** - Technology, culture, and regional news

## 🤖 AI Processing Pipeline

1. **Web Scraping**: Bright Data MCP collects articles from trusted sources
2. **Categorization**: LangChain agents classify articles into 8 categories
3. **Summarization**: AI generates concise 2-3 sentence summaries
4. **DNA Generation**: Automatic assignment of unique tracking codes
5. **Threading**: Smart linking of related stories across time/countries

## 🎨 UI Features

- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Interactive Map**: Click countries to filter news
- **Category Filters**: Toggle between different news categories
- **Thread View**: Visualize story evolution with timeline
- **Search**: Find articles by DNA code, topic, or keywords
- **Real-time Stats**: Live article and thread counts

## 🔧 Development

### Database Operations

```bash
# Generate Prisma client
npm run db:generate

# Push schema changes
npm run db:push

# Create migration
npm run db:migrate
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🚀 Deployment

The application is ready for deployment on:

- **Vercel** (recommended for Next.js)
- **Netlify**
- **Railway**
- **DigitalOcean App Platform**

Make sure to:
1. Set up your PostgreSQL database
2. Configure environment variables
3. Run database migrations
4. Set up Bright Data MCP integration

## 🔑 API Keys Setup

### OpenAI API Key
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Create an account and generate an API key
3. Add to your `.env` file

### Bright Data Setup
1. Sign up at [Bright Data](https://brightdata.com/)
2. Get your API credentials
3. Follow the MCP integration guide
4. Add credentials to your `.env` file

## 📈 Future Enhancements

- [ ] Real-time notifications for breaking news
- [ ] Advanced search with semantic similarity
- [ ] Multi-language support
- [ ] Mobile app development
- [ ] Social sharing features
- [ ] User personalization and preferences
- [ ] Advanced analytics dashboard
- [ ] API for third-party integrations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the troubleshooting guide

---

Built with ❤️ for revolutionary news consumption
