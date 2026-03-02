// Mock for @modelcontextprotocol/sdk

class Server {
	constructor () {
		this.handlers = new Map();
	}

	setRequestHandler () { }

	async connect () { }
}

class StdioServerTransport {
	// Mock transport
}

const ListToolsRequestSchema = 'ListToolsRequestSchema';
const CallToolRequestSchema = 'CallToolRequestSchema';

module.exports = {
	Server,
	StdioServerTransport,
	ListToolsRequestSchema,
	CallToolRequestSchema,
};
