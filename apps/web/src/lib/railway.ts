const RAILWAY_API = "https://backboard.railway.com/graphql/v2";

function getToken(): string {
  const token = process.env.RAILWAY_API_TOKEN;
  if (!token) throw new Error("RAILWAY_API_TOKEN is not set");
  return token;
}

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(RAILWAY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join(", "));
  }
  return json.data as T;
}

export async function createService(
  projectId: string,
  name: string,
  repo: string,
  branch: string = "main",
  rootDirectory: string = "apps/agent"
): Promise<{ serviceId: string; environmentId: string }> {
  // Get the default environment for this project
  const projData = await gql<{
    project: { environments: { edges: { node: { id: string } }[] } };
  }>(
    `query($id: String!) {
      project(id: $id) {
        environments { edges { node { id } } }
      }
    }`,
    { id: projectId }
  );

  const environmentId = projData.project.environments.edges[0]?.node.id;
  if (!environmentId) throw new Error("No environment found for project");

  // Create service with repo source
  const data = await gql<{ serviceCreate: { id: string } }>(
    `mutation($input: ServiceCreateInput!) {
      serviceCreate(input: $input) { id }
    }`,
    {
      input: {
        projectId,
        name,
        source: { repo },
      },
    }
  );

  const serviceId = data.serviceCreate.id;

  // Connect repo with branch
  await gql(
    `mutation($id: String!, $input: ServiceConnectInput!) {
      serviceConnect(id: $id, input: $input) { id }
    }`,
    {
      id: serviceId,
      input: { repo, branch },
    }
  );

  // Set root directory and dockerfile path
  await gql(
    `mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
    }`,
    {
      serviceId,
      environmentId,
      input: {
        rootDirectory,
      },
    }
  );

  return { serviceId, environmentId };
}

export async function setEnvVars(
  projectId: string,
  serviceId: string,
  environmentId: string,
  vars: Record<string, string>
): Promise<void> {
  // Use variableCollectionUpsert to set all vars in one call
  await gql(
    `mutation($input: VariableCollectionUpsertInput!) {
      variableCollectionUpsert(input: $input)
    }`,
    {
      input: {
        projectId,
        serviceId,
        environmentId,
        variables: vars,
      },
    }
  );
}

export async function createVolume(
  projectId: string,
  serviceId: string,
  environmentId: string,
  mountPath: string = "/data"
): Promise<string> {
  const data = await gql<{ volumeCreate: { id: string } }>(
    `mutation($input: VolumeCreateInput!) {
      volumeCreate(input: $input) { id }
    }`,
    {
      input: {
        projectId,
        serviceId,
        environmentId,
        mountPath,
      },
    }
  );
  return data.volumeCreate.id;
}

export async function createDomain(
  serviceId: string,
  environmentId: string
): Promise<string> {
  const data = await gql<{ serviceDomainCreate: { domain: string } }>(
    `mutation($input: ServiceDomainCreateInput!) {
      serviceDomainCreate(input: $input) { domain }
    }`,
    {
      input: {
        serviceId,
        environmentId,
      },
    }
  );
  return data.serviceDomainCreate.domain;
}

export async function getDeploymentStatus(
  deploymentId: string
): Promise<{ status: string }> {
  const data = await gql<{
    deployment: { status: string };
  }>(
    `query($id: String!) {
      deployment(id: $id) { status }
    }`,
    { id: deploymentId }
  );
  return { status: data.deployment.status };
}

export async function getLatestDeployment(
  projectId: string,
  serviceId: string,
  environmentId: string
): Promise<{ id: string; status: string } | null> {
  const data = await gql<{
    deployments: { edges: { node: { id: string; status: string } }[] };
  }>(
    `query($input: DeploymentListInput!) {
      deployments(input: $input, first: 1) {
        edges { node { id status } }
      }
    }`,
    {
      input: {
        projectId,
        serviceId,
        environmentId,
      },
    }
  );

  const edge = data.deployments.edges[0];
  return edge ? { id: edge.node.id, status: edge.node.status } : null;
}

export async function getDeploymentLogs(
  deploymentId: string
): Promise<string[]> {
  const data = await gql<{
    deploymentLogs: { message: string }[];
  }>(
    `query($id: String!) {
      deploymentLogs(deploymentId: $id, limit: 200) { message }
    }`,
    { id: deploymentId }
  );
  return data.deploymentLogs.map((l) => l.message);
}
