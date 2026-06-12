import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PartnerApiClient } from '../partnerApiClient.js';

interface RegisterResourcesParams {
  server: McpServer;
  client: PartnerApiClient;
}

interface ResourceDefinition {
  name: string;
  uri: string;
  title: string;
  description: string;
  path: string;
}

const resources: ResourceDefinition[] = [
  {
    name: 'COUNT_chart_of_accounts',
    uri: 'count://chart-of-accounts',
    title: 'COUNT Chart of Accounts',
    description: 'Read-only snapshot of the authenticated workspace chart of accounts.',
    path: '/partners/chart-of-accounts',
  },
  {
    name: 'COUNT_customers',
    uri: 'count://customers',
    title: 'COUNT Customers',
    description: 'Read-only snapshot of customers in the authenticated workspace.',
    path: '/partners/customers',
  },
  {
    name: 'COUNT_vendors',
    uri: 'count://vendors',
    title: 'COUNT Vendors',
    description: 'Read-only snapshot of vendors in the authenticated workspace.',
    path: '/partners/vendors',
  },
  {
    name: 'COUNT_products',
    uri: 'count://products',
    title: 'COUNT Products',
    description: 'Read-only snapshot of products and services in the authenticated workspace.',
    path: '/partners/products',
  },
  {
    name: 'COUNT_people',
    uri: 'count://people',
    title: 'COUNT People',
    description: 'Read-only snapshot of people records in the authenticated workspace.',
    path: '/partners/people',
  },
  {
    name: 'COUNT_recurring_invoice_templates',
    uri: 'count://recurring-invoice-templates',
    title: 'COUNT Recurring Invoice Templates',
    description: 'Read-only snapshot of recurring invoice templates in the authenticated workspace.',
    path: '/partners/recurring-invoice-templates',
  },
];

export function registerResources(params: RegisterResourcesParams): void {
  const { server, client } = params;

  for (const resource of resources) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        title: resource.title,
        description: resource.description,
        mimeType: 'application/json',
      },
      async (uri) => {
        const response = await client.request({
          method: 'GET',
          path: resource.path,
          requiresUserAuth: true,
        });

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      },
    );
  }
}

