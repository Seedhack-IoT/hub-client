package main

import (
    "bufio"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "log"
    "os"
    "strconv"

    "golang.org/x/crypto/ssh"
)

// gets path to private key
func getSigner(path string) (ssh.Signer, error) {
    pemBytes, err := ioutil.ReadFile(path)
    if err != nil {
        return nil, err
    }
    return ssh.ParsePrivateKey(pemBytes)
}

type Action struct {
    Name   string
    Params map[string]string
}

type Sensor struct {
    Type     string
    Name     string
    DataType string
}

type Config struct {
    Hub struct {
        Port int
        Host string
    }
    Client struct {
        Reset   bool
        Name    string
        Uuid    string
        Actions []*Action
        Sensors []*Sensor
    }
    Key struct {
        Priv, Pub string
    }
}

func ReadConfig(path string) (*Config, error) {
    var cfg Config
    raw, err := ioutil.ReadFile(path)
    if err != nil {
        return nil, err
    }
    err = json.Unmarshal(raw, &cfg)
    if err != nil {
        return nil, err
    }
    return &cfg, nil
}

var config *Config

func main() {
    if len(os.Args) <= 1 {
        log.Panicf("need path to config.json")
    }

    var err error
    config, err = ReadConfig(os.Args[1])
    if err != nil {
        log.Panicf("error reading config %s", err)
    }

    signer, err := getSigner(config.Key.Priv)
    if err != nil {
        log.Panicf("error reading private key %s", err)
    }

    sshConfig := &ssh.ClientConfig{
        User: config.Client.Uuid,
        Auth: []ssh.AuthMethod{
            ssh.PublicKeys(signer),
        },
    }

    client, err := ssh.Dial("tcp", config.Hub.Host+":"+strconv.Itoa(config.Hub.Port), sshConfig)
    if err != nil {
        panic("Failed to dial: " + err.Error())
    }

    // get channel
    channel, reqChan, err := client.OpenChannel("apf_data", nil)
    if err != nil {
        log.Panicf("Failed to create channel: %s", err.Error())
    }

    defer channel.Close()

    // ignore requests
    go func() {
        for req := range reqChan {
            req.Reply(false, nil)
        }
    }()

    // channel connected
    log.Println("You're now connected and a channel is created.")

    // now pipe those inputs
    readStdin := bufio.NewReader(os.Stdin)
    readChannel := bufio.NewReader(channel)

    go func() {
        for {
            line, err := readChannel.ReadString('\n')
            // log.Printf("Received %d data.", len(line))
            if err != nil {
                log.Printf("Error reading from channel: %s", err)
                break
            }
            fmt.Print(line)
        }
    }()

    for {
        line, err := readStdin.ReadString('\n')
        if err != nil {
            log.Printf("Error on reading stdin (%s)", err)
        }
        b, err := channel.Write([]byte(line))
        if err != nil {
            log.Printf("Error writing on channel (%s).", err)
        }
        // log.Printf("Wrote %d bytes.", b)
    }
}