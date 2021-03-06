import React, { Component } from 'react';
import by from 'sort-by';
import queryString from 'query-string';
import Hypertopic from 'hypertopic';
import conf from '../../config/config.json';
import Viewpoint from '../Viewpoint/Viewpoint.jsx';
import Corpora from '../Corpora/Corpora.jsx';

import '../../styles/App.css';

class Portfolio extends Component {
  constructor() {
    super();
    this.state = {
      viewpoints: [],
      corpora: [],
      items: [],
      selectedItems: [],
      topicsItems: new Map()
    };
    this.user = conf.user || location.hostname.split('.', 1)[0];
    this._updateSelection();
  }

  render() {
    let viewpoints = this._getViewpoints();
    let corpora = this._getCorpora();
    let status = this._getStatus();
    return (
      <div className="App">
        <h1>{this.user}</h1>
        <div className="Status">{status}</div>
        <div className="App-content">
          <div className="Description">
            {viewpoints}
          </div>
          {corpora}
        </div>
      </div>
    );
  }

  componentDidMount() {
    this._fetchAll();
    this._timer = setInterval(
      () => {
        this._fetchAll();
      },
      10000
    );
  }

  componentDidUpdate(prevProps) {
    if (this.props !== prevProps) {
      this._updateSelection();
      this._updateSelectedItems();
    }
  }

  componentWillUnmount() {
    clearInterval(this._timer);
  }

  _getTopic(id) {
    for (let v of this.state.viewpoints) {
      if (v[id]) return v[id];
    }
    return null;
  }

  _getStatus() {
    let topics = this.selection.map(t => {
      let topic = this._getTopic(t);
      return (topic)? topic.name : 'Thème inconnu';
    });
    return topics.join(' + ') || 'Tous les items';
  }

  _updateSelection() {
    let selection = queryString.parse(location.search).t;
    this.selection = (selection instanceof Array)? selection
      : (selection)? [selection]
      : [];
  }

  _getTopicPath(topicId) {
    let topic = this._getTopic(topicId);
    let path = (topic && topic.broader)? this._getTopicPath(topic.broader[0].id) : [];
    path.push(topicId);
    return path;
  }

  _getItemTopicsPaths(item) {
    return (item.topic||[]).map(t => this._getTopicPath(t.id));
  }

  _getRecursiveItemTopics(item) {
    return Array.prototype.concat(...this._getItemTopicsPaths(item));
  }

  _isSelected(item) {
    return includes(this._getRecursiveItemTopics(item), this.selection);
  }

  _updateSelectedItems() {
    let selectedItems = this.state.items
      .filter(e => this._isSelected(e, this.selection));
    let topicsItems = new Map();
    for (let e of selectedItems) {
      for (let t of this._getRecursiveItemTopics(e)) {
        push(topicsItems, t, e.id);
      }
    }
    this.setState({selectedItems, topicsItems});
  }

  _fetchAll() {
    const hypertopic = new Hypertopic(conf.services);
    return hypertopic.getView(`/user/${this.user}`)
      .then(data => {
        let user = data[this.user];
        if (!this.state.viewpoints.length && !this.state.corpora.length) { //TODO compare old and new
          this.setState({viewpoints:user.viewpoint, corpora:user.corpus});
        }
        return user;
      })
      .then(x =>
        x.viewpoint.map(y => `/viewpoint/${y.id}`)
          .concat(x.corpus.map(y => `/corpus/${y.id}`))
      )
      .then(hypertopic.getView)
      .then(data => {
        let viewpoints = [];
        for (let v of this.state.viewpoints) {
          let viewpoint = data[v.id];
          viewpoint.id = v.id;
          viewpoints.push(viewpoint);
        }
        this.setState({viewpoints});
        return data;
      })
      .then(data => {
        let items = [];
        for (let corpus of this.state.corpora) {
          for (let itemId in data[corpus.id]) {
            if (!['id','name','user'].includes(itemId)) {
              let item = data[corpus.id][itemId];
              if (!item.name || !item.name.length || !item.thumbnail || !item.thumbnail.length) {
                console.log(itemId, "has no name or thumbnail!", item);
              } else {
                item.id = itemId;
                item.corpus = corpus.id;
                items.push(item);
              }
            }
          }
        }
        this.setState({items:items.sort(by('name'))});
      })
      .then(x => {
        this._updateSelectedItems();
      });
  }

  _getViewpoints() {
    return this.state.viewpoints.sort(by('name')).map(v =>
      <Viewpoint key={v.id} viewpoint={v} selection={this.selection}
        topicsItems={this.state.topicsItems} />
    );
  }

  _getCorpora() {
    let ids = this.state.corpora.map(c => c.id);
    return (
      <Corpora ids={ids} from={this.state.items.length} items={this.state.selectedItems} />
    );
  }
}

function includes(array1, array2) {
  let set1 = new Set(array1);
  return array2.map(e => set1.has(e))
    .reduce((c1,c2) => c1 && c2, true);
}

function push(map, topicId, itemId) {
  let old = map.get(topicId);
  if (old) {
    map.set(topicId, old.add(itemId));
  } else {
    map.set(topicId, new Set([itemId]));
  }
}

export default Portfolio;
