export interface ServicePreset {
  label: string;
  description: string;
  unit: string;
  defaultQty: number;
  defaultPriceUSD: number;
}

export const DEVCITY_SERVICE_PRESETS: ServicePreset[] = [
  {
    label: 'Dedicated Engineering Squad (Monthly)',
    description: 'Dedicated Senior Software Engineering Squad (Lead Architect + 2 Full-Stack Engineers, Agile Sprint Execution)',
    unit: 'month',
    defaultQty: 1,
    defaultPriceUSD: 16000,
  },
  {
    label: 'Full-Stack Web App Development (Sprint)',
    description: 'React/Next.js & Node.js/Go Microservices Application Development (2-week Sprint Milestone)',
    unit: 'sprint',
    defaultQty: 1,
    defaultPriceUSD: 6500,
  },
  {
    label: 'Mobile App MVP (React Native / Flutter)',
    description: 'Cross-Platform iOS & Android Mobile Application MVP Development with API & State Architecture',
    unit: 'milestone',
    defaultQty: 1,
    defaultPriceUSD: 12000,
  },
  {
    label: 'Cloud Infrastructure & DevOps Setup',
    description: 'AWS/GCP Kubernetes Architecture, Terraform Infrastructure as Code & Zero-Downtime CI/CD Pipeline',
    unit: 'project',
    defaultQty: 1,
    defaultPriceUSD: 5000,
  },
  {
    label: 'UI/UX Design System & Interactive Prototype',
    description: 'User Journey Mapping, High-Fidelity Figma Component Library & Design Tokens Specification',
    unit: 'project',
    defaultQty: 1,
    defaultPriceUSD: 3800,
  },
  {
    label: 'AI & Custom LLM Agent Integration',
    description: 'Enterprise Retrieval-Augmented Generation (RAG) Pipeline, Vector DB Setup & Model Fine-tuning',
    unit: 'milestone',
    defaultQty: 1,
    defaultPriceUSD: 8500,
  },
  {
    label: 'Cybersecurity Audit & Penetration Testing',
    description: 'End-to-End Application Vulnerability Assessment, Threat Modeling & SOC2 Remediation Report',
    unit: 'audit',
    defaultQty: 1,
    defaultPriceUSD: 4500,
  },
  {
    label: 'Hourly Engineering Consultation',
    description: 'Principal Software Architecture Consultation & Codebase Technical Due Diligence',
    unit: 'hrs',
    defaultQty: 10,
    defaultPriceUSD: 125,
  },
];
