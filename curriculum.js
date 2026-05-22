// Golden Eagle Programme — AI Leadership Transformation Curriculum
// 24 weeks across 6 phases
window.CURRICULUM = [
  {
    phase: 1,
    title: "Executive AI Strategy & Foundations",
    weeks: "1-4",
    items: [
      { week: 1, topic: "AI Fundamentals & Business Alignment",  content: "Generative vs. Predictive AI, LLMs vs. SLMs",                                   owner: "Padma" },
      { week: 2, topic: "Prompt Engineering Frameworks",         content: "Role, Context, Task & Constraint prompting; preventing data leakage",             owner: "Sandeep" },
      { week: 3, topic: "AI Strategy & The Maturity Model",      content: "AI adoption roadmap and steering committees",                                     owner: "Shuchi" },
      { week: 4, topic: "Enterprise Vendor Evaluation",          content: "Build vs. Buy decisions for AI solutions",                                         owner: "Devendra" },
    ],
  },
  {
    phase: 2,
    title: "Personal Productivity & Advanced Prompting",
    weeks: "5-8",
    items: [
      { week: 5, topic: "Machine Learning for Project Leaders",  content: "ML lifecycle and data pipeline comprehension",                                    owner: "Naren" },
      { week: 6, topic: "Advanced Prompt Chaining",              content: "Multi-step prompts, forcing JSON/Structured outputs",                              owner: "Ram" },
      { week: 7, topic: "AI Knowledge Assistants (RAG Lite)",    content: "NotebookLM, Claude Projects, and Custom GPTs",                                    owner: "Vani" },
      { week: 8, topic: "Enterprise Workspace AI",               content: "MS Copilot, Jira AI, and automation",                                             owner: "Sasi Rekha" },
    ],
  },
  {
    phase: 3,
    title: "Vibe Coding & AI Agents",
    weeks: "9-12",
    items: [
      { week: 9,  topic: "Introduction to Vibe Coding",          content: "Using Cursor IDE, GitHub Copilot, and Claude Artifacts" },
      { week: 10, topic: "AI Agents & Model Context Protocol",   content: "Copilots vs. Autonomous Agents; MCP as USB-C for AI" },
      { week: 11, topic: "Single-Step Automation",               content: "Webhooks, API triggers, and legacy software integration" },
      { week: 12, topic: "Enterprise Multi-Agent Workflows",     content: "n8n visual workflow building and supervisor agents" },
    ],
  },
  {
    phase: 4,
    title: "Agile AI Delivery",
    weeks: "13-16",
    items: [
      { week: 13, topic: "Scrum for AI & QA",                    content: "Managing non-deterministic sprints; LLM-as-a-judge evaluation" },
      { week: 14, topic: "AI FinOps & Cost Management",          content: "Input/output token costs, caching strategies" },
      { week: 15, topic: "MLOps & Deployment",                   content: "Continuous integration and model drift monitoring" },
      { week: 16, topic: "AI ROI & OKRs",                        content: "Business value measurement and KPI tracking" },
    ],
  },
  {
    phase: 5,
    title: "AI Architecture & Governance",
    weeks: "17-20",
    items: [
      { week: 17, topic: "Enterprise AI System Architecture",    content: "Fine-Tuning vs. RAG; Multimodal architectures" },
      { week: 18, topic: "RAG Fundamentals",                     content: "Vector databases, embeddings, document chunking" },
      { week: 19, topic: "AI Security, Risks & Ethics",          content: "Algorithmic bias, Prompt Injection, PII Masking" },
      { week: 20, topic: "Enterprise AI Governance",             content: "Guardrails, acceptable use policies, compliance" },
    ],
  },
  {
    phase: 6,
    title: "Build, Launch & Career Transformation",
    weeks: "21-24",
    items: [
      { week: 21, topic: "AI SaaS Ideation & Product Thinking",  content: "Market gap identification, user persona development" },
      { week: 22, topic: "Building Your AI MVP",                 content: "Functional minimum viable product with vibe coding" },
      { week: 23, topic: "Personal Brand & Authority",           content: "LinkedIn profile optimisation, Go-to-market strategy" },
      { week: 24, topic: "Capstone Shark Tank Pitch",            content: "Final live presentation to industry leaders" },
    ],
  },
];

window.GOAL_PRESETS = [
  { id: "ai-leader",    label: "Become an AI-First IT Leader",        focus: [1, 2, 4] },
  { id: "ai-architect", label: "Become an AI Solution Architect",     focus: [3, 4, 5] },
  { id: "ai-saas",      label: "Launch an AI SaaS Product",           focus: [2, 3, 6] },
  { id: "ai-coach",     label: "Become an AI Coach / Consultant",     focus: [1, 2, 6] },
  { id: "ai-pm",        label: "Become an AI Product Manager",        focus: [2, 4, 6] },
];
