const Vue = require('vue');
require('./graph.js');

const getComplexityFromName = name => {
  const matches = name.match(/^\((\d+[.,]?\d*)\).+$/);
  if (!matches) return null;
  return matches[1];
};

const getNameWithoutComplexity = name => {
  const matchedComplexity = getComplexityFromName(name);
  if (matchedComplexity) {
    return name.replace(`(${matchedComplexity})`, '');
  }
  return name;
};

window.graphHandler = new Vue({
  el: '#graphHandler',

  data: {
    currentParent: '',
    currentChild: '',
    newTicketId: '',
    newTicketName: '',
    dataAsJson: '',
  },

  methods: {
    addDependency(parent, child) {
      this.addGraphDependency(parent, child);
      window.trelloHandler.addTrelloDependency(parent, child);
    },

    addGraphDependency(parent, child) {
      window.myDiagram.startTransaction('Add dependency');
      window.myDiagram.model.addLinkData({
        from: parseInt(parent, 10),
        to: parseInt(child, 10),
      });
      window.myDiagram.commitTransaction('Add dependency');

      this.currentChild = '';
      this.currentParent = '';
    },

    addOrUpdateTicket(ticketId, ticketName, estimate) {
      const currentNode = window.myDiagram.model.findNodeDataForKey(ticketId);
      if (currentNode == null) {
        window.myDiagram.startTransaction('Add ticket');
        const newTicket = {
          key: ticketId,
          name: ticketName,
          complexity: estimate,
        };
        window.myDiagram.model.addNodeData(newTicket);
        window.myDiagram.commitTransaction('Add ticket');
      } else {
        window.myDiagram.startTransaction('Update ticket');
        window.myDiagram.model.setDataProperty(
          currentNode,
          'name',
          getNameWithoutComplexity(ticketName)
        );
        window.myDiagram.model.setDataProperty(
          currentNode,
          'complexity',
          getComplexityFromName(ticketName)
        );
        window.myDiagram.commitTransaction('Update ticket');
      }
    },

    removeTicket(ticketId) {
      const currentNode = window.myDiagram.findNodeForKey(ticketId);
      if (currentNode != null) {
        window.myDiagram.startTransaction('Remove ticket');
        window.myDiagram.remove(currentNode);
        window.myDiagram.commitTransaction('Remove ticket');
      }
    },

    getNodes() {
      return window.myDiagram.model.nodeDataArray;
    },

    saveData() {
      this.dataAsJson = window.myDiagram.model.toJson();
    },

    loadData() {
      window.myDiagram.model = window.go.Model.fromJson(this.dataAsJson);
    },
  },
});
