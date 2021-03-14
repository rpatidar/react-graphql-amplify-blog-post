import React, { Component } from 'react';
import aws_exports from './aws-exports';
import { withAuthenticator } from 'aws-amplify-react';
import { Connect } from 'aws-amplify-react';
import { S3Image } from 'aws-amplify-react';
import Amplify, { API, graphqlOperation, Storage } from 'aws-amplify';
import { Divider, Form, Grid, Header, Icon, Input, List, Segment } from 'semantic-ui-react';
import {BrowserRouter as Router, Route, NavLink} from 'react-router-dom';
import {v4 as uuid} from 'uuid';

var QRCode = require('qrcode.react');

Amplify.configure(aws_exports);


function makeComparator(key, order = 'asc') {
  return (a, b) => {
    if (!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) return 0;

    const aVal = (typeof a[key] === 'string') ? a[key].toUpperCase() : a[key];
    const bVal = (typeof b[key] === 'string') ? b[key].toUpperCase() : b[key];

    let comparison = 0;
    if (aVal > bVal) comparison = 1;
    if (aVal < bVal) comparison = -1;

    return order === 'desc' ? (comparison * -1) : comparison
  };
}


const ListAlbums = `query ListAlbums {
  listAlbums(limit: 9999) {
      items {
          id
          name
      }
  }
}`;

const SubscribeToNewAlbums = `
  subscription OnCreateAlbum {
    onCreateAlbum {
      id
      name
    }
  }
`;

const GetAlbum = `query GetAlbum($id: ID!, $nextTokenForPhotos: String) {
  getAlbum(id: $id) {
    id
    name
    members
    photos(sortDirection: DESC, nextToken: $nextTokenForPhotos) {
      nextToken
      items {
        fullsize {
          width
          height
          key
        }

	thumbnail {
          width
          height
          key
        }
      }
    }
  }
}
`;

class AlbumsList extends React.Component {
  albumItems() {
    return this.props.albums.sort(makeComparator('name')).map(album =>
      <List.Item key={album.id}>
        <NavLink to={`/albums/${album.id}`}>{album.name}</NavLink>
      </List.Item>
    );
  }

  render() {
    return (
      <Segment>
        <Header as='h3'>My Albums</Header>
        <List divided relaxed>
          {this.albumItems()}
        </List>
      </Segment>
    );
  }
}


class AlbumsListLoader extends React.Component {
  onNewAlbum = (prevQuery, newData) => {
    let updatedQuery = Object.assign({}, prevQuery);
    updatedQuery.listAlbums.items = prevQuery.listAlbums.items.concat([newData.onCreateAlbum]);
    return updatedQuery;
  }

  render() {
    return (
      <Connect
        query={graphqlOperation(ListAlbums)}
        subscription={graphqlOperation(SubscribeToNewAlbums)}
        onSubscriptionMsg={this.onNewAlbum}
      >
        {({ data, loading, errors }) => {
          if (loading) { return <div>Loading...</div>; }
          if (!data.listAlbums) return;

          return <AlbumsList albums={data.listAlbums.items} />;
        }}
      </Connect>
    );
  }
}


class NewAlbum extends Component {
  constructor(props) {
    super(props);
    this.state = {
      albumName: ''
    };
  }

  handleChange = (e, { name, value }) => this.setState({ [name]: value })

  handleSubmit = async (event) => {
    event.preventDefault();
    const NewAlbum = `mutation NewAlbum($name: String!) {
          createAlbum(input: {name: $name}) {
              id
              name
          }
      }`;
    try {
      const result = await API.graphql(graphqlOperation(NewAlbum, { name: this.state.albumName }));
      console.info(`Created album with id ${result.data.createAlbum.id}`);
      this.setState({ albumName: ''});
    }
    catch (err) {
      console.error('NewAlbum mutation failed', err);
    }
  }

  render() {
    return (
      <Segment>
        <Header as='h3'>Add a new album</Header>
        <Input
          type='text'
          placeholder='New Album Name'
          icon='plus'
          iconPosition='left'
          action={{ content: 'Create', onClick: this.handleSubmit }}
          name='albumName'
          value={this.state.albumName}
          onChange={this.handleChange}
        />
      </Segment>
    )
  }
}


class AlbumDetailsLoader extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      nextTokenForPhotos: null,
      hasMorePhotos: true,
      album: null,
      loading: true,

      value: window.location.href,
      size: 128,
      fgColor: '#000000',
      bgColor: '#ffffff',
      level: 'L',
      renderAs: 'svg',
      includeMargin: false,
      includeImage: true,
      imageH: 24,
      imageW: 24,
      imageX: 0,
      imageY: 0,
      imageSrc: 'http://www.pngimagesfree.com/Design/Welcome/welcome-namaste-hand-png.png',
      imageExcavate: true,
      centerImage: true
    }
  }

  async loadMorePhotos() {
    if (!this.state.hasMorePhotos) return;

    this.setState({ loading: true });
    const { data } = await API.graphql(graphqlOperation(GetAlbum, {id: this.props.id, nextTokenForPhotos: this.state.nextTokenForPhotos}));
    let album;

    if (this.state.album === null) {
      album = data.getAlbum;
    } else {
      album = this.state.album;
      album.photos.items = album.photos.items.concat(data.getAlbum.photos.items);
    }

    this.setState({ 
      album: album,
      loading: false,
      nextTokenForPhotos: data.getAlbum.photos.nextToken,
      hasMorePhotos: data.getAlbum.photos.nextToken !== null
    });
  }

  componentDidMount() {
    this.loadMorePhotos();
  }

  render() {
    return <div > 
        <QRCode
          value={this.state.value}
          size={this.state.size}
          fgColor={this.state.fgColor}
          bgColor={this.state.bgColor}
          level={this.state.level}
          renderAs={this.state.renderAs}
          includeMargin={this.state.includeMargin}
          imageSettings={
            this.state.includeImage
              ? {
                  src: this.state.imageSrc,
                  height: this.state.imageH,
                  width: this.state.imageW,
                  x: this.state.centerImage ? null : this.state.imageX,
                  y: this.state.centerImage ? null : this.state.imageY,
                  excavate: this.state.imageExcavate,
                }
              : null
          } />
        <AlbumDetails loadingPhotos={this.state.loading} album={this.state.album} loadMorePhotos={this.loadMorePhotos.bind(this)} hasMorePhotos={this.state.hasMorePhotos}/>;

      </div>
  }
}


class AlbumDetails extends Component {
  render() {
    if (!this.props.album) return 'Loading album...';
    return (
      <Segment>
        <Header as='h3'>{this.props.album.name}</Header>

        {/* <Segment.Group>
          <Segment>
            <AlbumMembers members={this.props.album.members} />
          </Segment>
          <Segment basic>
            <AddUsernameToAlbum albumId={this.props.album.id} />
          </Segment>
        </Segment.Group> */}

        <S3ImageUpload albumId={this.props.album.id}/>        
        <PhotosList photos={this.props.album.photos.items} />
        {
          this.props.hasMorePhotos && 
          <Form.Button
            onClick={this.props.loadMorePhotos}
            icon='refresh'
            disabled={this.props.loadingPhotos}
            content={this.props.loadingPhotos ? 'Loading...' : 'Load more photos'}
          />
        }
      </Segment>
    )
  }
}



class S3ImageUpload extends React.Component {
  constructor(props) {
    super(props);
    this.state = { uploading: false }
  }

  onChange = async (e) => {
    const file = e.target.files[0];
    const fileName = uuid();
    this.setState({uploading: true});
    const result = await Storage.put(
      fileName, 
      file, 
      {
        customPrefix: { public: 'uploads/' },
        metadata: { albumid: this.props.albumId }
      }
    );
    console.log('Uploaded file: ', result);
    this.setState({uploading: false});
  }

  render() {
    return (
      <div>
        <Form.Button
              onClick={() => document.getElementById('add-image-file-input').click()}
              disabled={this.state.uploading}
              icon='file image outline'
              content={ this.state.uploading ? 'Uploading...' : 'Add Image' }
        />
        <input
          id='add-image-file-input'
          type="file"
          accept='image/*'
          onChange={this.onChange}
          style={{ display: 'none' }}
        />
      </div>
    );
  }
}


class PhotosList extends React.Component {
  photoItems() {
    return this.props.photos.map(photo =>
      <S3Image 
        key={photo.fullsize.key} 
        imgKey={photo.fullsize.key.replace('public/', '')}
        style={{display: 'inline-block', 'paddingRight': '5px'}}
      />
    );
  }

  render() {
    return (
      <div>
        <Divider hidden />
        {this.photoItems()}
      </div>
    );
  }
}


class AddUsernameToAlbum extends Component {
  constructor(props) {
    super(props);
    this.state = { username: '' };
  }

  handleChange = (e, { name, value }) => this.setState({ [name]: value })

  handleSubmit = async (event) => {
    event.preventDefault();
    const AddUsernameToAlbum = `
      mutation AddUsernameToAlbum($username: String!, $albumId: String!) {
          addUsernameToAlbum(username: $username, albumId: $albumId) {
              id
          }
      }`;
    const result = await API.graphql(graphqlOperation(AddUsernameToAlbum, { username: this.state.username, albumId: this.props.albumId }));
    console.log(`Added ${this.state.username} to album id ${result.data.addUsernameToAlbum.id}`);
    this.setState({ username: '' });
  }

  render() {
    return (
      <Input
        type='text'
        placeholder='Username'
        icon='user plus'
        iconPosition='left'
        action={{ content: 'Add', onClick: this.handleSubmit }}
        name='username'
        value={this.state.username}
        onChange={this.handleChange}
      />
    )
  }
}


const AlbumMembers = (props) => (
  <div>
    <Header as='h4'>
      <Icon name='user circle' />
      <Header.Content>Members</Header.Content>
    </Header>
    <List bulleted>
        {props.members && props.members.map((member) => <List.Item key={member}>{member}</List.Item>)}
    </List>
  </div>
);


class App extends Component {
  render() {
    return (
      <Router>
        <Grid padded>
          <Grid.Column>
            <Route path="/" exact component={NewAlbum}/>
            <Route path="/" exact component={AlbumsListLoader}/>

            <Route
              path="/albums/:albumId"
              render={ () => <div><NavLink to='/'>Back to Albums list</NavLink></div> }
            />
            <Route
              path="/albums/:albumId"
              render={ props => <AlbumDetailsLoader id={props.match.params.albumId}/> }
            />
          </Grid.Column>
        </Grid>
      </Router>
    );
  }
}

export default withAuthenticator(App, { includeGreetings: true });
