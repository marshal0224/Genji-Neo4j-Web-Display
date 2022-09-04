import './App.css';
import React from 'react'
import Filter from './components/filter'
import Poem from './components/PoemTable'
import Title from './components/title';
import $ from 'jquery';
import KeywordSearch from './components/keywordsearch';
import {BrowserRouter, Route, Routes, NavLink, Link, Navigate } from 'react-router-dom';
import { Breadcrumb, Col, Image, Layout, Menu, Row } from 'antd';
import Search from './components/Search';
import { HeaderImg } from './components/Header';
import { Home } from './components/Home';

const { Header, Content, Footer } = Layout;

export default class App extends React.Component{
  constructor() {
    super()
    this.uri = process.env.REACT_APP_NEO4J_URI
    this.user = process.env.REACT_APP_NEO4J_USERNAME
    this.password = process.env.REACT_APP_NEO4J_PASSWORD
    this.app_username = process.env.REACT_APP_USERNAME
    this.app_password = process.env.REACT_APP_PASSWORD
    // Init all filter states to be false (unchanged)
    this.state = {
      displayPT: false,
      displayST: false,
      key: 'odd',
      chapter: "",
      speaker: "",
      addressee: "",
      spkrGen: "Any",
      addrGen: "Any",
      spkrOn: true,
      addrOn: true,
      count: 0,
      app_username: '',
      app_password: '',
      auth: false,
    }
    this.characters = []
    this.genders = []
    this.changeKey = this.changeKey.bind(this)
    this.updateUsername = this.updateUsername.bind(this)
    this.updatePassword = this.updatePassword.bind(this)
    this.login = this.login.bind(this)
    this.logout = this.logout.bind(this)
    this.filterRef = React.createRef()
    this.poemCount = this.poemCount.bind(this)
    this.searchRef = React.createRef()
    this.search = this.search.bind(this)
  }

  componentDidUpdate() {
    this.characters = this.filterRef.state.characters
    this.genders = this.filterRef.state.genders
  }
  
  changeKey() {
    if (this.state.key === 'odd') {
      this.setState({
        key: 'even'
      })
    } else {
      this.setState({
        key: 'odd'
      })
    }
  }

  query = (event) => {
    this.poemCount()
    this.setState({ 
      displayPT: true,
      displayST: false,
      chapter: this.filterRef.state.selectedChapter,
      speaker: this.filterRef.state.selectedSpeaker,
      addressee: this.filterRef.state.selectedAddressee,
      spkrGen: this.filterRef.state.selectedSpeakerGender,
      addrGen: this.filterRef.state.selectedAddresseeGender,
    }, () => console.log('queried'))} 

  search = (event) => {
    this.setState({
      displayPT: false, 
      displayST: true, 
      keyword: this.searchRef.value,
    }, () => console.log('searched'))
  }

  spkrDisplay

  toggleSpkr = (event) => {
    this.setState({
      spkrOn: !this.state.spkrOn
    },
      () => {
        if (this.state.spkrOn) {
          this.spkrDisplay = 'table-cell'
        } else {
          this.spkrDisplay = 'none'
        }
        $('.spkrCol').css('display', this.spkrDisplay)
        console.log('speaker display is' + this.state.spkrOn)
      }
    )
  }

  addrDisplay

  toggleAddr = (event) => {
    this.setState({
      addrOn: !this.state.addrOn
    },
      () => {
        if (this.state.addrOn) {
          this.addrDisplay = 'table-cell'
        } else {
          this.addrDisplay = 'none'
        }
        $('.addrCol').css('display', this.addrDisplay)
        console.log('addressee display is' + this.state.addrOn)
      }
    )
  }

// login scripts
  updateUsername(event) {
    this.setState({
      app_username: event.target.value
    })
  }

  updatePassword(event) {
    this.setState({
      app_password: event.target.value
    })
  }

  login() {
    if (this.state.app_username === this.app_username && this.state.app_password === this.app_password) {
      this.setState({
        auth: true,
      }, () => alert('Hi Professor Vincent, you are now logged in.'))
    } else{
      alert('Wrong credentials, please try again.')
    }
  }

  logout() {
    this.setState({
      auth: false,
    }, () => 
    {
      alert('Professor Vincent, you are now logged out.')
      this.query()
    })
  }

  poemCount(count) {
    this.setState({
      count: count,
    })
  }

  render() {
    return (
      <div className="App">
      <HeaderImg title="The Tale of Genji Poem Database" subTitle="Beta Version"/>
      <Layout
        style={{
          height: "90vh"
        }}
      >
      <Header
        style={{
          position: 'relative',
          // zIndex: 1,
          width: '100%',
          padding: '0',
          background: 'white',
        }}
      >
      {/* <div className='login'>
        <label>
          Username:
          <input onChange={this.updateUsername}></input>
        </label>
        <button disabled={this.state.auth} onClick={this.login}>Log in</button>
        <br/>
        <label>
          Password:
          <input onChange={this.updatePassword}></input>
        </label>
        <button disabled={!this.state.auth} onClick={this.logout}>Log out</button>
      </div> */}
      <Menu
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          textAlign: 'center',
        }}
        mode="horizontal"
        items={[
          {
            key: 'Home',
            label: (
              <Link to="/">Home</Link>
            )
          }, 
          {
            key: 'Chapters',
            label: 'Chapters'
          }, 
          {
            key: 'Characters',
            label: 'Characters'
          }, 
          {
            key: 'Poems',
            label: 'Poems'
          }, 
          {
            key: 'Search',
            label: (
              <Link to="/search">Search</Link>
            )
          }, 
          {
            key: 'Edit',
            label: 'Edit'
          }
        ]}
      />
      </Header> 
      <Content
        className="site-layout"
        style={{
          position: 'relative',
          padding: '0 50px',
          height: "calc(90vh - 134px)",
          backgroundColor: 'white', 
        }}
      >
      {/* ######
      REMEMBER TO DEAL WITH THE FILTER & PT
      ######*/}
      {/* <div className='filter'>
        <Filter ref={(filterRef) => {this.filterRef = filterRef}} uri={this.uri} user={this.user} password={this.password}/>
        <br/>
        <button onClick={this.query}>Query</button>
        <button onClick={this.filterRef.resetFilters}>Reset Filters</button>
        <br/>
        {this.state.displayPT && <p>{this.state.count} poems queried</p>}
        <br />
        <div>
              <input ref={(searchRef) => {this.searchRef = searchRef}}></input>
              <button onClick={this.search}>Search</button>
        </div>
      </div> */}
      {/* <br />
      <div className='PT'>
        {this.state.displayPT && <Poem key={this.state.key} changeKey={this.changeKey} uri={this.uri} user={this.user} password={this.password} chapter={this.state.chapter} characters={this.characters} speaker={this.state.speaker} addressee={this.state.addressee} genders={this.genders} spkrGen={this.state.spkrGen} addrGen={this.state.addrGen} auth={this.state.auth} updateCount={this.poemCount}/>}
      </div>
      {this.state.displayST && <KeywordSearch uri={this.uri} user={this.user} password={this.password} keyword={this.state.keyword}/>} */}
      <Routes>
          <Route path="/" element={<Home />}/>
          <Route path="/search" element={<Search />}>
            <Route path="/search/poem_table" element={<Poem />}></Route>
          </Route>
          <Route path="/" element={<Navigate to="/"/>} />
      </Routes>
      </Content>
      <Footer
        style={{
          textAlign: 'center',
        }}
      >
        J. Keith Vincent © 2022
      </Footer>
      </Layout>
      </div>
    )}}