const Vue = require('vue');
require('./trelloApiHelper.js');
require('./graphHandler.js');

const lastBoardChoice = 'lastBoardChoice';
const lastListChoice = 'lastListChoice';

window.trelloHandler = new Vue({
  el: '#trello',

  data: {
    authenticated: false,
    boards: null,
    selectedBoard: null,
    lists: null,
    selectedList: null,
    cards: null,
    loading: false,
    trelloUrl: null,
  },

  methods: {
    onBoardChange(event) {
      const boardId = event.target.value;

      this.selectBoard(boardId).then(() => {
        window.localStorage.setItem(lastBoardChoice, boardId);
      });
    },

    onListChange(event) {
      const listId = event.target.value;

      this.selectList(listId).then(() => {
        window.localStorage.setItem(lastListChoice, listId);
      });
    },

    authorize() {
      window.token = '';
      window.clubhouseColumn = 0;

      window.Trello.getAjax(`https://api.clubhouse.io/api/v2/search/stories`, {
        token: window.token,
        query: `state:${window.clubhouseColumn}`,
        page_size: 25,
      }).then(response => {
        const vm = this;
        const data = response.data.filter(card => !card.archived);
        vm.cards = data;
        vm.deleteUselessCards();
        vm.addOrUpdateCards();
        vm.calculateDependenciesAsPromises().then(linkDataArray => {
          window.myDiagram.model.linkDataArray = linkDataArray;
          vm.loading = false;
        });
      });
    },

    authSuccessHandler() {
      const vm = this;
      console.log('Successful authentication'); // eslint-disable-line no-console
      this.loading = true;
      window.Trello.get('/member/me/boards').then(data => {
        vm.boards = data;
        vm.loading = false;

        // Thanks to Vue.nextTick, we wait for Vue to update the DOM, for the board dropdown to be filled with
        // the list of boards before retrieveLastBoardAndListChoice sets a chosen value in the board dropdown.
        Vue.nextTick(vm.retrieveLastBoardAndListChoice);
      });
    },
    retrieveLastBoardAndListChoice() {
      const boardChoiceId = window.localStorage.getItem(lastBoardChoice);
      const listChoiceId = window.localStorage.getItem(lastListChoice);

      if (!boardChoiceId || !listChoiceId) {
        return Promise.resolve();
      }

      return this.selectBoard(boardChoiceId).then(() =>
        Vue.nextTick(this.selectList(listChoiceId))
      );
    },

    selectBoard(boardId) {
      this.selectedBoard = boardId;

      return Promise.all([
        window.Trello.get(`/boards/${boardId}/lists`),
        window.Trello.get(`/boards/${boardId}/shortUrl`),
      ]).then(([lists, trelloUrl]) => {
        this.lists = lists;
        this.trelloUrl = trelloUrl._value; // eslint-disable-line no-underscore-dangle
      });
    },

    selectList(listId) {
      this.selectedList = listId;
      return this.refresh();
    },

    addOrUpdateCards() {
      for (let i = 0; i < this.cards.length; i += 1) {
        const card = this.cards[i];
        window.graphHandler.addOrUpdateTicket(
          card.id,
          card.name,
          card.estimate
        );
      }
    },

    deleteUselessCards() {
      const nodes = window.graphHandler.getNodes();
      const toBeRemoved = [];
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (!this.isTicketIdInList(node.key)) {
          toBeRemoved.push(node.key);
        }
      }
      for (let i = 0; i < toBeRemoved.length; i += 1) {
        window.graphHandler.removeTicket(toBeRemoved[i]);
      }
    },

    calculateDependenciesAsPromises() {
      const vm = this;
      const linkDataArray = [];
      const promises = [];
      vm.cards.forEach(card => {
        promises.push(
          new Promise(resolve => {
            vm.getCompleteStoryObject(card).then(story => {
              story.story_links.forEach(sLink => {
                if (!linkDataArray.find(l => l.from === sLink.object_id)) {
                  linkDataArray.push({
                    from: sLink.subject_id,
                    to: sLink.object_id,
                  });
                }
              });
              resolve();
            });
          })
        );
      });
      return new Promise(resolve => {
        Promise.all(promises).then(() => {
          resolve(linkDataArray);
        });
      });
    },

    getTicketIdFromIdCard(idCard) {
      if (this.cards == null) {
        return null;
      }
      for (let i = 0; i < this.cards.length; i += 1) {
        if (this.cards[i].id === idCard) {
          return this.cards[i].idShort;
        }
      }
      return null;
    },

    isTicketIdInList(ticketId) {
      for (let i = 0; i < this.cards.length; i += 1) {
        if (this.cards[i].idShort === ticketId) {
          return true;
        }
      }
      return false;
    },

    addTrelloDependency(parentId, childId) {
      let childCard = null;
      let parentCard = null;
      if (this.cards == null) {
        console.warn('Fail adding dependency in Trello'); // eslint-disable-line no-console
        return false;
      }
      for (let i = 0; i < this.cards.length; i += 1) {
        if (this.cards[i].idShort === childId) {
          childCard = this.cards[i];
        }
        if (this.cards[i].idShort === parentId) {
          parentCard = this.cards[i];
        }
      }
      if (childCard == null || parentCard == null) {
        console.warn('Fail adding dependency in Trello'); // eslint-disable-line no-console
        return false;
      }
      return this.getOrCreateDependencyChecklist(childCard).then(checklist => {
        const checkItem = {
          name: parentCard.url,
        };
        window.Trello.post(`/checklists/${checklist.id}/checkItems`, checkItem);
      });
    },

    deleteTrelloDependency(parentId, childId) {
      const vm = this;
      let childCard = null;
      if (this.cards == null) {
        console.warn('Fail deleting dependency in Trello'); // eslint-disable-line no-console
        return false;
      }
      for (let i = 0; i < this.cards.length; i += 1) {
        if (this.cards[i].idShort === childId) {
          childCard = this.cards[i];
        }
      }
      if (childCard == null) {
        console.warn('Fail deleting dependency in Trello'); // eslint-disable-line no-console
        return false;
      }
      return this.getOrCreateDependencyChecklist(childCard).then(checklist => {
        const ticketIds = vm.getDependentTicketsFromStory(checklist);
        for (let i = 0; i < ticketIds.length; i += 1) {
          if (ticketIds[i].ticketId === parentId) {
            window.Trello.delete(
              `/checklists/${checklist.id}/checkItems/${ticketIds[i].checkItemId}`
            );
            console.log('Dependency deleted'); // eslint-disable-line no-console
            return;
          }
        }
      });
    },

    getDependentTicketsFromStory(story) {
      const ticketIds = [];
      if (story.checkItems == null) {
        return ticketIds;
      }
      for (let i = 0; i < story.checkItems.length; i += 1) {
        const checkItem = story.checkItems[i];
        ticketIds.push({
          checkItemId: checkItem.id,
          ticketId: this.getTicketIdFromCheckItemName(checkItem.name),
        });
      }
      return ticketIds;
    },

    getTicketIdFromCheckItemName(checkItemName) {
      if (checkItemName[0] === '#') {
        return checkItemName.split('#')[1];
      }
      return parseInt(checkItemName.split('/')[5].split('-')[0], 10);
    },

    getCompleteStoryObject(card) {
      return window.Trello.getAjax(
        `https://api.clubhouse.io/api/v2/stories/${card.id}`,
        {
          token: window.token,
        }
      );
    },
  },
});
