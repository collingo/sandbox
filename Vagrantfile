# -*- mode: ruby -*-
# vi: set ft=ruby :

# Vagrantfile API/syntax version. Don't touch unless you know what you're doing!
VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.provider "docker" do |d|
    d.build_dir = "."
    d.ports = ["8080:8080"]
    d.vagrant_vagrantfile = "./Vagrantfile_docker"
  end
end
